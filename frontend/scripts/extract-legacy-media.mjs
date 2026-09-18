/**
 * One-off extract of non-gallery stills from the old single-file site.
 * Gallery 01–22 is handled by extract-gallery.mjs.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const oldHtml = join(__dirname, "../../../photo arena old/index_27.html");
const tmpDir = join(__dirname, "../../tmp-audit-imgs");
const publicDir = join(__dirname, "../public");
const mediaDir = join(publicDir, "media");

if (!existsSync(oldHtml)) {
  console.error("Old HTML not found:", oldHtml);
  process.exit(1);
}

mkdirSync(join(mediaDir, "home"), { recursive: true });
mkdirSync(join(mediaDir, "services"), { recursive: true });
mkdirSync(join(mediaDir, "bookings"), { recursive: true });
mkdirSync(join(mediaDir, "sets"), { recursive: true });
mkdirSync(join(mediaDir, "booths"), { recursive: true });

function writeDataUrl(dataUrl, dest) {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error(`Not a data URL: ${dest}`);
  writeFileSync(dest, Buffer.from(match[2], "base64"));
  console.log("wrote", dest.replace(publicDir, "/public"), Buffer.from(match[2], "base64").length);
}

function copyIfPresent(src, dest) {
  if (!existsSync(src)) return false;
  copyFileSync(src, dest);
  console.log("copied", dest.replace(publicDir, "/public"));
  return true;
}

const html = readFileSync(oldHtml, "utf8");
const imgRe = /<img\b([^>]*)>/gi;
const images = [];
let match;
while ((match = imgRe.exec(html))) {
  const attrs = match[1];
  const src = (attrs.match(/src="([^"]*)"/) || [])[1] || "";
  const alt = (attrs.match(/alt="([^"]*)"/) || [])[1] || "";
  if (!src.startsWith("data:")) continue;
  const after = html.slice(match.index, match.index + 800);
  const heading = (after.match(/<h3 class="[^"]*">([^<]+)<\/h3>/) || [])[1] || "";
  images.push({ alt, src, heading, index: images.length });
}

const byAlt = new Map();
for (const image of images) {
  if (!byAlt.has(image.alt)) byAlt.set(image.alt, image);
}

const named = [
  ["Corporate and Birthday Photography at Photo Arena", join(mediaDir, "home/personal-birthday-corporate.jpg")],
  ["Children and Baby Photography at Photo Arena", join(mediaDir, "home/bundle-of-joy.jpg")],
  ["Pre-Wedding Photography at Photo Arena", join(mediaDir, "home/pre-wedding.jpg")],
  ["Studio Space Rental at Photo Arena", join(mediaDir, "home/space-rental.jpg")],
  ["Inside the Photo Arena studio space", join(mediaDir, "about.jpg")],
  ["Birthday Photography at Photo Arena", join(mediaDir, "services/birthday.jpg")],
  ["Children Photography at Photo Arena", join(mediaDir, "services/children.jpg")],
  ["Pre-Wedding Photos at Photo Arena", join(mediaDir, "services/pre-wedding.jpg")],
  ["Professional Indoor Portraits at Photo Arena", join(mediaDir, "services/portraits.jpg")],
  ["Passport / Visa Photos at Photo Arena", join(mediaDir, "services/passport.jpg")],
  ["Corporate Headshots at Photo Arena", join(mediaDir, "services/corporate.jpg")],
  ["Personal / Birthday Shoots", join(mediaDir, "bookings/personal-birthday.jpg")],
  ["Pre-Wedding / Couples", join(mediaDir, "bookings/pre-wedding.jpg")],
  ["Family Shoots", join(mediaDir, "bookings/family.jpg")],
  ["Corporate Headshots", join(mediaDir, "bookings/corporate.jpg")],
  ["Maternity Shoots", join(mediaDir, "bookings/maternity.jpg")],
  ["Bundle of Joy · 0–1 Year", join(mediaDir, "bookings/bundle-of-joy-0-1.jpg")],
  ["Bundle of Joy · 2–6 Years", join(mediaDir, "bookings/bundle-of-joy-2-6.jpg")],
  ["Teens Shoot · 7–15 Years", join(mediaDir, "bookings/teens-7-15.jpg")],
  ["The Curated Wall", join(mediaDir, "sets/curated-wall.jpg")],
  ["The Curated Cove", join(mediaDir, "sets/curated-cove.jpg")],
  ["The Arched Retreat", join(mediaDir, "sets/arched-retreat.jpg")],
  ["Aurora Wave", join(mediaDir, "sets/aurora-wave.jpg")],
  ["Swing Attitude", join(mediaDir, "booths/swing-attitude.jpg")],
  ["Odogwu Vibes", join(mediaDir, "booths/odogwu-vibes.jpg")],
  ["Let's Party Booth", join(mediaDir, "booths/lets-party.jpg")],
  ["Telephone Booth", join(mediaDir, "booths/telephone.jpg")],
];

for (const [alt, dest] of named) {
  const image = byAlt.get(alt);
  if (!image) {
    console.warn("missing alt:", alt);
    continue;
  }
  writeDataUrl(image.src, dest);
}

const sliders = images.filter((image) => image.alt === "Photo Arena Studio");
sliders.forEach((image, index) => {
  writeDataUrl(image.src, join(mediaDir, `bookings/studio-slide-${index + 1}.jpg`));
});

copyIfPresent(join(tmpDir, "favicon.png"), join(publicDir, "favicon.png"));

console.log("done. unique alts:", byAlt.size, "slider frames:", sliders.length);
