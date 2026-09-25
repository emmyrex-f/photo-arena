import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { parsePage, parsePageSize, paginate } from "../common/pagination";
import { parseMediaKind } from "../common/upload-path";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type GalleryListInput = {
  kind?: string;
  isActive?: boolean;
  featured?: boolean;
  category?: string;
  q?: string;
  page?: string;
  pageSize?: string;
};

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(input?: string | GalleryListInput) {
    const opts: GalleryListInput =
      typeof input === "string" ? { kind: input } : input ?? {};
    const page = parsePage(opts.page);
    const pageSize = parsePageSize(opts.pageSize, 24);
    const q = opts.q?.trim();
    const category = opts.category?.trim().toLowerCase();

    const where: Prisma.GalleryImageWhereInput = {
      ...(opts.kind ? { kind: parseMediaKind(opts.kind) } : {}),
      ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
      ...(opts.featured !== undefined ? { featured: opts.featured } : {}),
      ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
      ...(q
        ? {
            OR: [
              { alt: { contains: q, mode: "insensitive" } },
              { filename: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
              { url: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, items, active, featured] = await Promise.all([
      this.prisma.galleryImage.count({ where }),
      this.prisma.galleryImage.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.galleryImage.count({ where: { ...where, isActive: true } }),
      this.prisma.galleryImage.count({ where: { ...where, featured: true } }),
    ]);

    return {
      ...paginate(items, total, page, pageSize),
      counts: {
        active,
        featured,
        inactive: Math.max(0, total - active),
      },
    };
  }

  async upload(
    files: Express.Multer.File[],
    fields: { kind?: string; category?: string; alt?: string },
  ) {
    if (!files?.length) throw new BadRequestException("No files uploaded");
    if (files.length > 10) throw new BadRequestException("Max 10 files");

    const kind = parseMediaKind(fields.kind);

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

      const encoded = await sharp(file.buffer)
        .rotate()
        .webp({ quality: 85 })
        .toBuffer();
      const outMeta = await sharp(encoded).metadata();

      const thumbEncoded = await sharp(encoded)
        .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const stored = await this.storage.upload({
        buffer: encoded,
        filename,
        thumbBuffer: thumbEncoded,
        thumbFilename: thumbName,
        kind,
        contentType: "image/webp",
      });

      const row = await this.prisma.galleryImage.create({
        data: {
          filename,
          url: stored.url,
          thumbUrl: stored.thumbUrl ?? stored.url,
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

  getStorageStatus() {
    return this.storage.getIntegrationStatus();
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
    await this.storage.delete(row.url, row.thumbUrl);
    return { ok: true as const };
  }

  async reorder(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.galleryImage.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return { ok: true as const };
  }

  private async require(id: string) {
    const row = await this.prisma.galleryImage.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Gallery image not found");
    return row;
  }
}
