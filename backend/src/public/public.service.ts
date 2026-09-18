import { Injectable, NotFoundException } from "@nestjs/common";
import { MediaKind, Prisma } from "@prisma/client";
import { parsePage, parsePageSize, paginate } from "../common/pagination";
import { PricingService } from "../pricing/pricing.service";
import { PrismaService } from "../prisma/prisma.service";

const PUBLIC_PREFIXES = [
  "site.",
  "social.",
  "hero.",
  "tour.",
  "instagram.",
  "analytics.",
  "seo.",
  "policies.",
];

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async settings() {
    const rows = await this.prisma.businessSettings.findMany();
    const out: Record<string, string> = {};
    for (const row of rows) {
      if (PUBLIC_PREFIXES.some((p) => row.key.startsWith(p))) {
        out[row.key] = row.value;
      }
    }
    return out;
  }

  async services() {
    await this.pricing.refresh();
    const discountPercent = this.pricing.getOnlineDiscountBps() / 100;
    const services = await this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        packages: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    const usages = await this.prisma.mediaUsage.findMany({
      where: {
        usageType: "service",
        entityId: { in: services.map((row) => row.id) },
        media: { isActive: true },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        entityId: true,
        media: { select: { id: true, url: true, thumbUrl: true, alt: true } },
      },
    });
    const publicServiceMedia = new Map<string, { id: string; url: string; thumbUrl: string | null; alt: string }>();
    for (const row of usages) {
      if (!publicServiceMedia.has(row.entityId)) {
        publicServiceMedia.set(row.entityId, row.media);
      }
    }
    return services.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      kind: s.kind,
      summary: s.summary,
      description: s.description,
      startingPriceKobo: s.startingPriceKobo,
      isProvisional: s.isProvisional,
      sortOrder: s.sortOrder,
      media: publicServiceMedia.get(s.id) ?? null,
      packages: s.packages.map((p) => ({
        id: p.id,
        name: p.name,
        durationMinutes: p.durationMinutes,
        includes: p.includes,
        priceKobo: p.priceKobo,
        onlinePriceKobo: this.pricing.calculatePayableKobo(p.priceKobo, "ONLINE"),
        discountPercent,
        isProvisional: p.isProvisional,
        sortOrder: p.sortOrder,
      })),
    }));
  }

  async gallery() {
    const items = await this.prisma.galleryImage.findMany({
      where: {
        isActive: true,
        kind: MediaKind.GALLERY,
        AND: [
          { OR: [{ width: null }, { width: { gte: 64 } }] },
          { OR: [{ height: null }, { height: { gte: 64 } }] },
        ],
      },
      orderBy: { sortOrder: "asc" },
    });
    const usages = await this.prisma.mediaUsage.findMany({
      where: {
        usageType: "portfolio",
        entityId: { in: items.map((row) => row.id) },
        media: { isActive: true },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        entityId: true,
        media: {
          select: { id: true, url: true, thumbUrl: true, alt: true, width: true, height: true },
        },
      },
    });
    const overlay = new Map<string, (typeof usages)[number]["media"]>();
    for (const row of usages) {
      if (!overlay.has(row.entityId)) overlay.set(row.entityId, row.media);
    }
    return items.map((g) => {
      const attached = overlay.get(g.id);
      const useOverlay = Boolean(attached) && !isTooSmall(attached?.width ?? null, attached?.height ?? null);
      if (useOverlay && attached) {
        return {
          id: g.id,
          url: attached.url,
          thumbUrl: attached.thumbUrl,
          alt: attached.alt,
          category: g.category,
          featured: g.featured,
          width: attached.width,
          height: attached.height,
          sortOrder: g.sortOrder,
          media: { id: attached.id, url: attached.url, thumbUrl: attached.thumbUrl, alt: attached.alt },
        };
      }
      return {
        id: g.id,
        url: g.url,
        thumbUrl: g.thumbUrl,
        alt: g.alt,
        category: g.category,
        featured: g.featured,
        width: g.width,
        height: g.height,
        sortOrder: g.sortOrder,
        media: null,
      };
    });
  }

  async testimonials() {
    const rows = await this.prisma.testimonial.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: "asc" },
    });
    const usages = await this.prisma.mediaUsage.findMany({
      where: {
        usageType: "testimonial",
        entityId: { in: rows.map((row) => row.id) },
        media: { isActive: true },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        entityId: true,
        media: { select: { id: true, url: true, thumbUrl: true, alt: true } },
      },
    });
    const publicMedia = new Map<string, { id: string; url: string; thumbUrl: string | null; alt: string }>();
    for (const row of usages) {
      if (!publicMedia.has(row.entityId)) publicMedia.set(row.entityId, row.media);
    }
    return rows.map((row) => ({
      ...row,
      media: publicMedia.get(row.id) ?? null,
    }));
  }

  async faqs() {
    return this.prisma.faq.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async blogList(pageRaw?: string, pageSizeRaw?: string, tag?: string) {
    const page = parsePage(pageRaw);
    const pageSize = parsePageSize(pageSizeRaw, 9);
    const where: Prisma.BlogPostWhereInput = {
      isPublished: true,
      ...(tag ? { tags: { has: tag } } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          coverImageUrl: true,
          tags: true,
          isPublished: true,
          publishedAt: true,
          authorId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    return paginate(rows, total, page, pageSize);
  }

  async blogBySlug(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, isPublished: true },
    });
    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  async createEnquiry(input: {
    name: string;
    email: string;
    phone?: string;
    sessionType?: string;
    message: string;
    botcheck?: string;
  }) {
    if (input.botcheck && input.botcheck.trim()) {
      return { id: "ok" };
    }
    const row = await this.prisma.enquiry.create({
      data: {
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim() || null,
        sessionType: input.sessionType?.trim() || null,
        message: input.message.trim(),
      },
    });
    return { id: row.id };
  }

  async subscribeNewsletter(email: string, source?: string) {
    const normalized = email.trim().toLowerCase();
    await this.prisma.newsletterSubscriber.upsert({
      where: { email: normalized },
      create: { email: normalized, source: source?.trim() || null, isActive: true },
      update: { isActive: true, source: source?.trim() || undefined },
    });
    return { ok: true as const };
  }
}

function isTooSmall(width: number | null, height: number | null) {
  if (typeof width === "number" && width > 0 && width < 64) return true;
  if (typeof height === "number" && height > 0 && height < 64) return true;
  return false;
}
