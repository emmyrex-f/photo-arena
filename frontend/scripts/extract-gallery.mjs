import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const oldHtml = join(__dirname, "../../../photo arena old/index_27.html");
const outDir = join(__dirname, "../public/gallery");
const manifestPath = join(__dirname, "../src/data/portfolio.generated.ts");

if (!existsSync(oldHtml)) {
  console.error("Old project HTML not found. Leaving gallery empty.");
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });

const html = readFileSync(oldHtml, "utf8");
const itemRe =
  /<div class="portfolio-item[^"]*"[^>]*data-category="([^"]+)"[\s\S]*?<img[^>]*src="(data:image\/([a-zA-Z0-9.+-]+);base64,([^"]+))"[^>]*alt="([^"]*)"/g;

const images = [];
let match;
let index = 0;

while ((match = itemRe.exec(html)) !== null) {
  const [, category, , mime, b64, alt] = match;
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const id = String(index + 1).padStart(2, "0");
  const filename = `${id}-${category}.${ext}`;
  writeFileSync(join(outDir, filename), Buffer.from(b64, "base64"));
  images.push({
    id: `pa-${id}`,
    src: `/gallery/${filename}`,
    alt: alt || `Photo Arena ${category} photograph`,
    category,
    featured: index < 8,
  });
  index += 1;
}

if (images.length === 0) {
  console.warn("No portfolio images extracted.");
}

writeFileSync(
  manifestPath,
  `export type PortfolioCategory = "birthdays" | "portraits" | "corporate" | "kids" | string;

export type PortfolioImage = {
  id: string;
  src: string;
  alt: string;
  category: PortfolioCategory;
  featured: boolean;
};

/** Extracted from the old site. Replace with originals when available. */
export const portfolioImages: PortfolioImage[] = ${JSON.stringify(images, null, 2)};
`,
);

console.log(`Extracted ${images.length} gallery images to public/gallery`);
