import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { join } from "path";
import sharp from "sharp";
import {
  absoluteUploadPath,
  assertInsideUploads,
  kindDirFor,
  parseMediaKind,
  publicUploadPath,
} from "../common/upload-path";
import { ensureUploadsDir, uploadsRoot } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

@Injectable()
export class GalleryService {
  constructor(private readonly prisma: PrismaService) {}

  list(input?: string | { kind?: string; isActive?: boolean; page?: string; pageSize?: string }) {
    const kind = typeof input === "string" ? input : input?.kind;
    const isActive = typeof input === "object" && input ? input.isActive : undefined;
    return this.prisma.galleryImage.findMany({
      where: {
        ...(kind ? { kind: parseMediaKind(kind) } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  async upload(
    files: Express.Multer.File[],
    fields: { kind?: string; category?: string; alt?: string },
  ) {
    if (!files?.length) throw new BadRequestException("No files uploaded");
    if (files.length > 10) throw new BadRequestException("Max 10 files");

    const kind = parseMediaKind(fields.kind);
    const kindDir = kindDirFor(kind);
    ensureUploadsDir();
    const dir = assertInsideUploads(join(uploadsRoot(), kindDir));
    await fs.mkdir(dir, { recursive: true });

    const max = await this.prisma.galleryImage.aggregate({ _max: { sortOrder: true } });
    let sortOrder = (max._max.sortOrder ?? -1) + 1;
    const created = [];

    for (const file of files) {
      if (file.size > 15 * 1024 * 1024) {
        throw new BadRequestException("Each file must be ≤ 15 MB");
      }

      let format: string | undefined;
      try {
        const meta = await sharp(file.buffer, { failOn: "error" }).metadata();
        format = meta.format;
      } catch {
        throw new BadRequestException("Only JPEG, PNG, or WebP images are allowed");
      }
      if (!format || !ALLOWED_FORMATS.has(format)) {
        throw new BadRequestException("Only JPEG, PNG, or WebP images are allowed");
      }

      const id = randomUUID();
      const filename = `${id}.webp`;
      const thumbName = `${id}-thumb.webp`;
      const fullPath = assertInsideUploads(join(dir, filename));
      const thumbPath = assertInsideUploads(join(dir, thumbName));

      const encoded = await sharp(file.buffer)
        .rotate()
        .webp({ quality: 85 })
        .toBuffer();
      const outMeta = await sharp(encoded).metadata();
      await fs.writeFile(fullPath, encoded);
      await sharp(encoded)
        .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(thumbPath);

      const row = await this.prisma.galleryImage.create({
        data: {
          filename,
          url: publicUploadPath(kind, filename),
          thumbUrl: publicUploadPath(kind, thumbName),
          width: outMeta.width ?? null,
          height: outMeta.height ?? null,
          kind,
          category: fields.category?.trim() || "general",
          alt: fields.alt?.trim() || "Gallery image",
          sortOrder,
          featured: false,
          isActive: true,
        },
      });
      created.push(row);
      sortOrder += 1;
    }

    return created;
  }

  async update(
    id: string,
    input: Partial<{
      alt: string;
      category: string;
      featured: boolean;
      isActive: boolean;
      sortOrder: number;
    }>,
  ) {
    await this.require(id);
    return this.prisma.galleryImage.update({ where: { id }, data: input });
  }

  async remove(id: string) {
    const row = await this.require(id);
    await this.prisma.galleryImage.delete({ where: { id } });
    for (const path of [row.url, row.thumbUrl]) {
      if (!path) continue;
      const abs = absoluteUploadPath(path);
      if (abs) await fs.unlink(abs).catch(() => undefined);
    }
    return { ok: true as const };
  }

  async reorder(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.galleryImage.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return this.list();
  }

  private async require(id: string) {
    const row = await this.prisma.galleryImage.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Gallery image not found");
    return row;
  }
}
