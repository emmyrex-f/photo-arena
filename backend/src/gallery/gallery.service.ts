import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { parsePage, parsePageSize, paginate } from "../common/pagination";
import { parseMediaKind } from "../common/upload-path";
import { MediaUsageService } from "../media-usage/media-usage.service";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
  "video/x-matroska",
]);
const USAGE_TYPE = "portfolio";

function getVideoExtension(mimetype: string, originalname: string): string {
  const lowerName = originalname.toLowerCase();
  if (lowerName.endsWith(".webm") || mimetype === "video/webm") return ".webm";
  if (lowerName.endsWith(".mp4") || mimetype === "video/mp4") return ".mp4";
  if (lowerName.endsWith(".mov") || mimetype === "video/quicktime") return ".mov";
  if (lowerName.endsWith(".ogg") || lowerName.endsWith(".ogv") || mimetype === "video/ogg") return ".ogg";
  return ".mp4";
}

export type GalleryListInput = {
  kind?: string;
  usageType?: string;
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
    private readonly mediaUsage: MediaUsageService,
  ) {}

  async list(input?: string | GalleryListInput) {
    const opts: GalleryListInput =
      typeof input === "string" ? { kind: input } : input ?? {};
    const page = parsePage(opts.page);
    const pageSize = parsePageSize(opts.pageSize, 24);
    const q = opts.q?.trim();
    const category = opts.category?.trim();

    const isServicesFilter =
      category?.toLowerCase() === "service" ||
      category?.toLowerCase() === "services" ||
      opts.usageType === "service";

    const where: Prisma.GalleryImageWhereInput = {
      ...(opts.kind ? { kind: parseMediaKind(opts.kind) } : {}),
      ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
      ...(opts.featured !== undefined ? { featured: opts.featured } : {}),
      ...(isServicesFilter
        ? {
            OR: [
              { category: { startsWith: "Service", mode: "insensitive" } },
              { usages: { some: { usageType: "service" } } },
            ],
          }
        : category
          ? { category: { equals: category, mode: "insensitive" } }
          : {}),
      ...(opts.usageType && !isServicesFilter
        ? { usages: { some: { usageType: opts.usageType } } }
        : {}),
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

    const decorated = await this.withMedia(items);
    return {
      ...paginate(decorated, total, page, pageSize),
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
      if (file.size > 100 * 1024 * 1024) {
        throw new BadRequestException("Each file must be ≤ 100 MB");
      }

      const isVideo =
        file.mimetype?.startsWith("video/") ||
        ALLOWED_VIDEO_MIMES.has(file.mimetype) ||
        /\.(mp4|webm|mov|ogg|ogv)$/i.test(file.originalname);

      if (isVideo) {
        const id = randomUUID();
        const ext = getVideoExtension(file.mimetype, file.originalname);
        const filename = `${id}${ext}`;

        const stored = await this.storage.upload({
          buffer: file.buffer,
          filename,
          kind,
          contentType: file.mimetype || "video/mp4",
        });

        const row = await this.prisma.galleryImage.create({
          data: {
            filename,
            url: stored.url,
            thumbUrl: stored.thumbUrl ?? stored.url,
            width: null,
            height: null,
            kind,
            category: fields.category?.trim() || "video",
            alt: fields.alt?.trim() || file.originalname || "Uploaded video",
            sortOrder,
            featured: false,
            isActive: true,
          },
        });
        created.push(row);
        sortOrder += 1;
        continue;
      }

      let format: string | undefined;
      try {
        const meta = await sharp(file.buffer, { failOn: "error" }).metadata();
        format = meta.format;
      } catch {
        throw new BadRequestException("Only JPEG, PNG, WebP images or MP4, WebM videos are allowed");
      }
      if (!format || !ALLOWED_FORMATS.has(format)) {
        throw new BadRequestException("Only JPEG, PNG, WebP images or MP4, WebM videos are allowed");
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

  getPresignedUpload(input: {
    kind?: string;
    filename: string;
    contentType?: string;
    resourceType?: "image" | "video" | "auto";
  }) {
    const kind = parseMediaKind(input.kind);
    return this.storage.getPresignedUpload({
      kind,
      filename: input.filename,
      contentType: input.contentType,
      resourceType: input.resourceType,
    });
  }

  async completePresigned(input: {
    url: string;
    thumbUrl?: string;
    filename: string;
    width?: number;
    height?: number;
    kind?: string;
    category?: string;
    alt?: string;
  }) {
    if (!input.url) throw new BadRequestException("Upload URL is required");
    const kind = parseMediaKind(input.kind);
    const max = await this.prisma.galleryImage.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (max._max.sortOrder ?? -1) + 1;

    const row = await this.prisma.galleryImage.create({
      data: {
        filename: input.filename || "media",
        url: input.url,
        thumbUrl: input.thumbUrl || input.url,
        width: input.width ?? null,
        height: input.height ?? null,
        kind,
        category: input.category?.trim() || "general",
        alt: input.alt?.trim() || input.filename || "Uploaded media",
        sortOrder,
        featured: false,
        isActive: true,
      },
    });

    return row;
  }

  getStorageStatus() {
    return this.storage.getIntegrationStatus();
  }

  private async withMedia<T extends { id: string }>(items: T[]) {
    const mediaMap = await this.mediaUsage.primariesForEntities(
      USAGE_TYPE,
      items.map((row) => row.id),
    );
    return items.map((item) => {
      const media = mediaMap.get(item.id);
      return {
        ...item,
        media: media
          ? {
              id: media.id,
              url: media.url,
              thumbUrl: media.thumbUrl ?? media.url,
              alt: media.alt,
              filename: media.filename ?? null,
              isActive: media.isActive ?? true,
            }
          : null,
      };
    });
  }

  async update(
    id: string,
    input: Partial<{
      alt: string;
      category: string;
      featured: boolean;
      isActive: boolean;
      sortOrder: number;
      mediaId?: string | null;
    }>,
  ) {
    await this.require(id);
    const data: {
      alt?: string;
      category?: string;
      featured?: boolean;
      isActive?: boolean;
      sortOrder?: number;
    } = {};
    if (input.alt !== undefined) data.alt = input.alt;
    if (input.category !== undefined) data.category = input.category;
    if (input.featured !== undefined) data.featured = input.featured;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    const updated =
      Object.keys(data).length > 0
        ? await this.prisma.galleryImage.update({ where: { id }, data })
        : await this.require(id);

    if (input.mediaId !== undefined) {
      await this.mediaUsage.setPrimary({
        usageType: USAGE_TYPE,
        entityId: id,
        mediaId: input.mediaId,
      });
    }
    const decorated = await this.withMedia([updated]);
    return decorated[0]!;
  }

  async remove(id: string) {
    const row = await this.require(id);
    const usages = await this.prisma.mediaUsage.count({ where: { mediaId: id } });
    if (usages > 0) {
      throw new ConflictException(
        `Cannot delete media: image is currently in use across ${usages} entity/entities`,
      );
    }
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
