/**
 * One-shot: take the Photo Arena logo, knock out the black background, crop the
 * gold shutter (the only mark that reads at 16px), and write browser icon files.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, "../../backend/package.json"));
const sharp = require("sharp");

const SRC = process.argv[2];
const OUT = join(__dirname, "../public");
if (!SRC) {
  console.error("Usage: node scripts/build-favicon.mjs <logo.png>");
  process.exit(1);
}

function isNearBlack(r, g, b) {
  return r < 32 && g < 32 && b < 32;
}

function isGold(r, g, b, a) {
  if (a < 40) return false;
  return r > 140 && g > 70 && r >= g && b < g * 0.75;
}

/** Flood-fill from every border pixel that is near-black → alpha 0. */
function knockOutBackground(data, width, height) {
  const n = width * height;
  const seen = new Uint8Array(n);
  const stack = [];

  const pushIfBg = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (seen[i]) return;
    const o = i * 4;
    if (!isNearBlack(data[o], data[o + 1], data[o + 2])) return;
    seen[i] = 1;
    stack.push(i);
  };

  for (let x = 0; x < width; x += 1) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }

  while (stack.length) {
    const i = stack.pop();
    const x = i % width;
    const y = (i / width) | 0;
    data[i * 4 + 3] = 0;
    pushIfBg(x - 1, y);
    pushIfBg(x + 1, y);
    pushIfBg(x, y - 1);
    pushIfBg(x, y + 1);
  }
}

function goldBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const o = (y * width + x) * 4;
      if (!isGold(data[o], data[o + 1], data[o + 2], data[o + 3])) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) throw new Error("No gold shutter pixels found in the logo");
  return { minX, minY, maxX, maxY };
}

/** Keep only the circular shutter so neighbouring letters are not in the icon. */
function circularMask(data, width, height, cx, cy, radius) {
  const r2 = radius * radius;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r2) data[(y * width + x) * 4 + 3] = 0;
    }
  }
}

function pngIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  let offset = 6 + 16 * count;
  for (const png of pngBuffers) {
    const meta = {};
    entries.push({ png, offset, meta });
    offset += png.length;
  }

  const entryBufs = pngBuffers.map((png, i) => {
    const size = sharp(png).metadata();
    return size.then((m) => {
      const e = Buffer.alloc(16);
      e.writeUInt8(m.width >= 256 ? 0 : m.width, 0);
      e.writeUInt8(m.height >= 256 ? 0 : m.height, 1);
      e.writeUInt8(0, 2);
      e.writeUInt8(0, 3);
      e.writeUInt16LE(1, 4);
      e.writeUInt16LE(32, 6);
      e.writeUInt32LE(png.length, 8);
      e.writeUInt32LE(entries[i].offset, 12);
      return e;
    });
  });

  return Promise.all(entryBufs).then((bufs) => Buffer.concat([header, ...bufs, ...pngBuffers]));
}

async function squarePng(src, size) {
  return sharp(src)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
knockOutBackground(data, info.width, info.height);

const { minX, minY, maxX, maxY } = goldBounds(data, info.width, info.height);
const bw = maxX - minX + 1;
const bh = maxY - minY + 1;
const cx = (minX + maxX) / 2;
const cy = (minY + maxY) / 2;
circularMask(data, info.width, info.height, cx, cy, Math.max(bw, bh) / 2 + 2);

const pad = Math.ceil(Math.max(bw, bh) * 0.14);
const side = Math.ceil(Math.max(bw, bh) + pad * 2);
let left = Math.round(cx - side / 2);
let top = Math.round(cy - side / 2);
left = Math.max(0, Math.min(left, info.width - side));
top = Math.max(0, Math.min(top, info.height - side));
const cropW = Math.min(side, info.width - left);
const cropH = Math.min(side, info.height - top);

const transparent = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .extract({ left, top, width: cropW, height: cropH })
  .png()
  .toBuffer();

const sizes = {
  "favicon-16x16.png": 16,
  "favicon-32x32.png": 32,
  "favicon.png": 48,
  "apple-touch-icon.png": 180,
  "android-chrome-192x192.png": 192,
  "android-chrome-512x512.png": 512,
};

for (const [name, size] of Object.entries(sizes)) {
  const buf = await squarePng(transparent, size);
  writeFileSync(join(OUT, name), buf);
}

const ico = await pngIco([
  await squarePng(transparent, 16),
  await squarePng(transparent, 32),
  await squarePng(transparent, 48),
]);
writeFileSync(join(OUT, "favicon.ico"), ico);

console.log(
  `favicon set written from ${info.width}×${info.height} logo; shutter crop ${cropW}×${cropH} at (${left},${top})`,
);
