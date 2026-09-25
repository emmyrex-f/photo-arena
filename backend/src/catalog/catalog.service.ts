import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ServiceKind } from "@prisma/client";
import { slugify } from "../common/utils";
import { MediaUsageService } from "../media-usage/media-usage.service";
import { PricingService } from "../pricing/pricing.service";
import { PrismaService } from "../prisma/prisma.service";

const SERVICE_USAGE = "service";

export type ServiceMediaDto = {
  id: string;
  url: string;
  thumbUrl: string | null;
  alt: string;
  filename: string | null;
  isActive: boolean;
};

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly mediaUsage: MediaUsageService,
  ) {}

  async listServices() {
    const services = await this.prisma.service.findMany({
      orderBy: { sortOrder: "asc" },
      include: { packages: { orderBy: { sortOrder: "asc" } } },
    });
    return this.withMedia(services);
  }

  async createService(input: {
    slug?: string;
    name: string;
    kind?: ServiceKind;
    summary?: string;
    description: string;
    startingPriceKobo: number;
    isActive?: boolean;
    isProvisional?: boolean;
    mediaId?: string | null;
  }) {
    const max = await this.prisma.service.aggregate({ _max: { sortOrder: true } });
    const created = await this.prisma.service.create({
      data: {
        slug: input.slug?.trim() || slugify(input.name),
        name: input.name.trim(),
        kind: input.kind ?? ServiceKind.SESSION,
        summary: input.summary?.trim() || null,
        description: input.description.trim(),
        startingPriceKobo: input.startingPriceKobo,
        isActive: input.isActive ?? true,
        isProvisional: input.isProvisional ?? true,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      include: { packages: true },
    });
    if (input.mediaId) {
      await this.mediaUsage.setPrimary({
        usageType: SERVICE_USAGE,
        entityId: created.id,
        mediaId: input.mediaId,
      });
    }
    const decorated = await this.withMedia([created]);
    return decorated[0]!;
  }

  async updateService(
    id: string,
    input: Partial<{
      slug: string;
      name: string;
      kind: ServiceKind;
      summary: string | null;
      description: string;
      startingPriceKobo: number;
      isActive: boolean;
      isProvisional: boolean;
    }> & { mediaId?: string | null },
  ) {
    await this.requireService(id);
    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.startingPriceKobo !== undefined
          ? { startingPriceKobo: input.startingPriceKobo }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.isProvisional !== undefined ? { isProvisional: input.isProvisional } : {}),
      },
      include: { packages: { orderBy: { sortOrder: "asc" } } },
    });
    if (input.mediaId !== undefined) {
      await this.mediaUsage.setPrimary({
        usageType: SERVICE_USAGE,
        entityId: id,
        mediaId: input.mediaId,
      });
    }
    const decorated = await this.withMedia([updated]);
    return decorated[0]!;
  }

  async deleteService(id: string) {
    await this.requireService(id);
    const bookingCount = await this.prisma.booking.count({
      where: { package: { serviceId: id } },
    });
    if (bookingCount > 0) {
      const updated = await this.prisma.service.update({
        where: { id },
        data: { isActive: false },
        include: { packages: true },
      });
      const decorated = await this.withMedia([updated]);
      return decorated[0]!;
    }
    await this.mediaUsage.setPrimary({
      usageType: SERVICE_USAGE,
      entityId: id,
      mediaId: null,
    });
    await this.prisma.package.deleteMany({ where: { serviceId: id } });
    await this.prisma.service.delete({ where: { id } });
    return { ok: true as const };
  }

  async reorderServices(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.service.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return this.listServices();
  }

  async createPackage(
    serviceId: string,
    input: {
      name: string;
      durationMinutes: number;
      outfitCount?: number | null;
      backdropCount?: number | null;
      editedPhotoCount?: number | null;
      includes?: string;
      priceKobo: number;
      isActive?: boolean;
      isProvisional?: boolean;
    },
  ) {
    await this.requireService(serviceId);
    const max = await this.prisma.package.aggregate({
      where: { serviceId },
      _max: { sortOrder: true },
    });
    return this.prisma.package.create({
      data: {
        serviceId,
        name: input.name.trim(),
        durationMinutes: input.durationMinutes,
        outfitCount: input.outfitCount ?? null,
        backdropCount: input.backdropCount ?? null,
        editedPhotoCount: input.editedPhotoCount ?? null,
        includes: (input.includes ?? "").trim(),
        priceKobo: input.priceKobo,
        isActive: input.isActive ?? true,
        isProvisional: input.isProvisional ?? true,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      include: { service: true },
    });
  }

  async updatePackage(
    id: string,
    input: Partial<{
      name: string;
      durationMinutes: number;
      outfitCount: number | null;
      backdropCount: number | null;
      editedPhotoCount: number | null;
      includes: string;
      priceKobo: number;
      isActive: boolean;
      isProvisional: boolean;
    }>,
  ) {
    await this.requirePackage(id);
    return this.prisma.package.update({
      where: { id },
      data: input,
      include: { service: true },
    });
  }

  async deletePackage(id: string) {
    await this.requirePackage(id);
    const bookingCount = await this.prisma.booking.count({ where: { packageId: id } });
    if (bookingCount > 0) {
      return this.prisma.package.update({
        where: { id },
        data: { isActive: false },
        include: { service: true },
      });
    }
    await this.prisma.package.delete({ where: { id } });
    return { ok: true as const };
  }

  async reorderPackages(ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.package.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return this.prisma.package.findMany({
      where: { id: { in: ids } },
      include: { service: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  listPricingRules() {
    return this.prisma.pricingRule.findMany({ orderBy: { key: "asc" } });
  }

  async updatePricingRule(key: string, input: { bps?: number; isActive?: boolean }) {
    const rule = await this.prisma.pricingRule.findUnique({ where: { key } });
    if (!rule) throw new NotFoundException("Pricing rule not found");
    if (input.bps === undefined && input.isActive === undefined) {
      throw new BadRequestException("Provide bps and/or isActive");
    }
    const bps = input.bps ?? rule.bps;
    const isActive = input.isActive ?? rule.isActive;
    if (!Number.isInteger(bps) || bps < 0 || bps > 5000) {
      throw new BadRequestException("bps must be 0–5000 (0–50%)");
    }
    const updated = await this.prisma.pricingRule.update({
      where: { key },
      data: { bps, isActive },
    });
    await this.pricing.refresh();
    return updated;
  }

  private async withMedia<T extends { id: string }>(services: T[]) {
    const mediaMap = await this.mediaUsage.primariesForEntities(
      SERVICE_USAGE,
      services.map((row) => row.id),
    );
    return services.map((service) => ({
      ...service,
      media: toServiceMediaDto(mediaMap.get(service.id) ?? null),
    }));
  }

  async approveServicePricing(serviceId: string) {
    await this.requireService(serviceId);
    await this.prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: serviceId },
        data: { isProvisional: false },
      });
      await tx.package.updateMany({
        where: { serviceId },
        data: { isProvisional: false },
      });
      const remainingProvisional = await tx.service.count({
        where: { isProvisional: true },
      });
      if (remainingProvisional === 0) {
        await tx.businessSettings.upsert({
          where: { key: "site.pricesProvisional" },
          create: { key: "site.pricesProvisional", value: "false" },
          update: { value: "false" },
        });
      }
    });
    const updated = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { packages: { orderBy: { sortOrder: "asc" } } },
    });
    const decorated = await this.withMedia([updated!]);
    return decorated[0]!;
  }

  async approveAllPricing() {
    await this.prisma.$transaction(async (tx) => {
      await tx.service.updateMany({
        data: { isProvisional: false },
      });
      await tx.package.updateMany({
        data: { isProvisional: false },
      });
      await tx.businessSettings.upsert({
        where: { key: "site.pricesProvisional" },
        create: { key: "site.pricesProvisional", value: "false" },
        update: { value: "false" },
      });
    });
    return { ok: true as const };
  }

  private async requireService(id: string) {
    const row = await this.prisma.service.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Service not found");
    return row;
  }

  private async requirePackage(id: string) {
    const row = await this.prisma.package.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Package not found");
    return row;
  }
}

function toServiceMediaDto(
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
): ServiceMediaDto | null {
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
