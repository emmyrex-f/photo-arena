import { createHash, randomBytes } from "crypto";
import { mkdirSync } from "fs";
import { join } from "path";

export function uploadsRoot(): string {
  return process.env.UPLOADS_DIR || join(process.cwd(), "uploads");
}

export function ensureUploadsDir(): void {
  const root = uploadsRoot();
  mkdirSync(root, { recursive: true });
  for (const kind of ["gallery", "blog", "content"]) {
    mkdirSync(join(root, kind), { recursive: true });
  }
}

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, "");
}

export function newPaymentReference(): string {
  return `PA-${randomBytes(5).toString("hex").toUpperCase()}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Strip markdown to a short plain-text blurb for list cards. */
export function plainTextPreview(markdown: string, maxLen = 280): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/[*_~]+/g, "")
    .replace(/^\s*[-+*]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/[-*]{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen).replace(/\s+\S*$/, "").trimEnd()}…`;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const v = cell ?? "";
          if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
          return v;
        })
        .join(","),
    )
    .join("\n");
}
