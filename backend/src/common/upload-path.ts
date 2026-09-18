import { BadRequestException } from "@nestjs/common";
import { MediaKind } from "@prisma/client";
import { isAbsolute, relative, resolve, sep } from "path";
import { uploadsRoot } from "./utils";

const KIND_DIRS = ["gallery", "blog", "content"] as const;
type KindDir = (typeof KIND_DIRS)[number];

export function parseMediaKind(kind?: string): MediaKind {
  const normalized = (kind ?? "GALLERY").trim().toUpperCase();
  if (normalized === "GALLERY") return MediaKind.GALLERY;
  if (normalized === "BLOG") return MediaKind.BLOG;
  if (normalized === "CONTENT") return MediaKind.CONTENT;
  throw new BadRequestException("Invalid upload kind");
}

export function kindDirFor(kind: MediaKind): KindDir {
  const dir = kind.toLowerCase() as KindDir;
  if (!KIND_DIRS.includes(dir)) {
    throw new BadRequestException("Invalid upload kind");
  }
  return dir;
}

export function assertInsideUploads(absolutePath: string): string {
  const root = resolve(uploadsRoot());
  const resolved = resolve(absolutePath);
  const rel = relative(root, resolved);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new BadRequestException("Invalid upload path");
  }
  return resolved;
}

export function publicUploadPath(kind: MediaKind, filename: string): string {
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    throw new BadRequestException("Invalid upload filename");
  }
  return `/uploads/${kindDirFor(kind)}/${filename}`;
}

export function absoluteUploadPath(publicPath: string): string | null {
  if (!publicPath.startsWith("/uploads/")) return null;
  const relative = publicPath.slice("/uploads/".length);
  if (!relative || relative.includes("..")) {
    throw new BadRequestException("Invalid upload path");
  }
  const [dir, ...rest] = relative.split("/");
  if (!KIND_DIRS.includes(dir as KindDir) || rest.length !== 1) {
    throw new BadRequestException("Invalid upload path");
  }
  return assertInsideUploads(resolve(uploadsRoot(), dir, rest[0]));
}
