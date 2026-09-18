import { Injectable, NotFoundException } from "@nestjs/common";
import { MediaUsageService } from "../media-usage/media-usage.service";
import { PrismaService } from "../prisma/prisma.service";

const TESTIMONIAL_USAGE = "testimonial";

export type TestimonialMediaDto = {
  id: string;
  url: string;
  thumbUrl: string | null;
  alt: string;
  filename: string | null;
  isActive: boolean;
};

@Injectable()
export class TestimonialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUsage: MediaUsageService,
  ) {}

  async list() {
    const rows = await this.prisma.testimonial.findMany({ orderBy: { sortOrder: "asc" } });
    return this.withMedia(rows);
  }

  async create(input: {
    quote: string;
    name: string;
    role?: string | null;
    rating?: number | null;
    isPublished?: boolean;
    sortOrder?: number;
    mediaId?: string | null;
  }) {
    const max = await this.prisma.testimonial.aggregate({ _max: { sortOrder: true } });
    const created = await this.prisma.testimonial.create({
      data: {
        quote: input.quote,
        name: input.name,
        role: input.role ?? null,
        rating: input.rating ?? null,
        isPublished: input.isPublished ?? false,
        sortOrder: input.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
      },
    });
    if (input.mediaId) {
      await this.mediaUsage.setPrimary({
        usageType: TESTIMONIAL_USAGE,
        entityId: created.id,
        mediaId: input.mediaId,
      });
    }
    const decorated = await this.withMedia([created]);
    return decorated[0]!;
  }

  async update(
    id: string,
    input: Partial<{
      quote: string;
      name: string;
      role: string | null;
      rating: number | null;
      isPublished: boolean;
      sortOrder: number;
    }> & { mediaId?: string | null },
  ) {
    await this.require(id);
    const updated = await this.prisma.testimonial.update({
      where: { id },
      data: {
        ...(input.quote !== undefined ? { quote: input.quote } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
    if (input.mediaId !== undefined) {
      await this.mediaUsage.setPrimary({
        usageType: TESTIMONIAL_USAGE,
        entityId: id,
        mediaId: input.mediaId,
      });
    }
    const decorated = await this.withMedia([updated]);
    return decorated[0]!;
  }

  async remove(id: string) {
    await this.require(id);
    await this.mediaUsage.setPrimary({
      usageType: TESTIMONIAL_USAGE,
      entityId: id,
      mediaId: null,
    });
    await this.prisma.testimonial.delete({ where: { id } });
    return { ok: true as const };
  }

  async reorder(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) => this.prisma.testimonial.update({ where: { id }, data: { sortOrder: index } })),
    );
    return this.list();
  }

  private async withMedia<T extends { id: string }>(rows: T[]) {
    const mediaMap = await this.mediaUsage.primariesForEntities(
      TESTIMONIAL_USAGE,
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      ...row,
      media: toTestimonialMediaDto(mediaMap.get(row.id) ?? null),
    }));
  }

  private async require(id: string) {
    const row = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Testimonial not found");
    return row;
  }
}

function toTestimonialMediaDto(
  media:
    | {
        id: string;
        url: string;
        thumbUrl: string | null;
        alt: string;
        filename: string | null;
        isActive: boolean;
      }
    | null
    | undefined,
): TestimonialMediaDto | null {
  if (!media) return null;
  return {
    id: media.id,
    url: media.url,
    thumbUrl: media.thumbUrl,
    alt: media.alt,
    filename: media.filename,
    isActive: media.isActive,
  };
}
