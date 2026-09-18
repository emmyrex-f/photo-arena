import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  mediaAssetSelect,
  parseEntityId,
  parseMediaId,
  parseUsageType,
  type MediaUsageType,
} from "./media-usage.types";

const usageSelect = {
  id: true,
  mediaId: true,
  usageType: true,
  entityId: true,
  sortOrder: true,
  createdAt: true,
} as const;

const usageWithMediaSelect = {
  ...usageSelect,
  media: { select: mediaAssetSelect },
} as const;

export type AttachMediaInput = {
  mediaId: string;
  usageType: string;
  entityId: string;
  sortOrder?: number;
};

export type ReorderMediaUsagesInput = {
  usageType: string;
  entityId: string;
  ids: string[];
};

@Injectable()
export class MediaUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async attach(input: AttachMediaInput) {
    const mediaId = parseMediaId(input.mediaId);
    const usageType = parseUsageType(input.usageType);
    const entityId = parseEntityId(input.entityId);
    if (input.sortOrder !== undefined && (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)) {
      throw new BadRequestException("Invalid sort order");
    }

    const media = await this.prisma.galleryImage.findUnique({
      where: { id: mediaId },
      select: mediaAssetSelect,
    });
    if (!media) throw new NotFoundException("Gallery image not found");
    if (!media.isActive) {
      throw new BadRequestException("This media is not available");
    }

    const existing = await this.findUsage(mediaId, usageType, entityId);
    if (existing) return existing;

    const sortOrder = input.sortOrder ?? (await this.nextSortOrder(usageType, entityId));
    try {
      return await this.prisma.mediaUsage.create({
        data: { mediaId, usageType, entityId, sortOrder },
        select: usageWithMediaSelect,
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        const reused = await this.findUsage(mediaId, usageType, entityId);
        if (reused) return reused;
      }
      throwMappedPrisma(error, "Could not attach media");
    }
  }

  async listMediaForEntity(usageTypeRaw: string, entityIdRaw: string) {
    const usageType = parseUsageType(usageTypeRaw);
    const entityId = parseEntityId(entityIdRaw);
    return this.prisma.mediaUsage.findMany({
      where: { usageType, entityId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: usageWithMediaSelect,
    });
  }

  async listUsagesForMedia(mediaIdRaw: string) {
    const mediaId = parseMediaId(mediaIdRaw);
    await this.requireMedia(mediaId);
    return this.prisma.mediaUsage.findMany({
      where: { mediaId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: usageSelect,
    });
  }

  async getById(idRaw: string) {
    const id = parseMediaId(idRaw);
    const row = await this.prisma.mediaUsage.findUnique({ where: { id }, select: usageSelect });
    if (!row) throw new NotFoundException("Media usage not found");
    return row;
  }

  async detachById(idRaw: string) {
    const row = await this.getById(idRaw);
    try {
      await this.prisma.mediaUsage.delete({ where: { id: row.id } });
    } catch (error) {
      throwMappedPrisma(error, "Could not detach media");
    }
    return { ok: true as const, usage: row };
  }

  async detach(input: { mediaId: string; usageType: string; entityId: string }) {
    const mediaId = parseMediaId(input.mediaId);
    const usageType = parseUsageType(input.usageType);
    const entityId = parseEntityId(input.entityId);
    const row = await this.prisma.mediaUsage.findUnique({
      where: { mediaId_usageType_entityId: { mediaId, usageType, entityId } },
      select: usageSelect,
    });
    if (!row) throw new NotFoundException("Media usage not found");
    try {
      await this.prisma.mediaUsage.delete({ where: { id: row.id } });
    } catch (error) {
      throwMappedPrisma(error, "Could not detach media");
    }
    return { ok: true as const, usage: row };
  }

  async reorder(input: ReorderMediaUsagesInput) {
    const usageType = parseUsageType(input.usageType);
    const entityId = parseEntityId(input.entityId);
    if (!Array.isArray(input.ids) || input.ids.length === 0) {
      throw new BadRequestException("Reorder list is required");
    }
    const ids = input.ids.map((id) => parseMediaId(id));
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("Reorder list has duplicate ids");
    }

    const existing = await this.prisma.mediaUsage.findMany({
      where: { usageType, entityId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((row) => row.id));
    if (existing.length !== ids.length || ids.some((id) => !existingIds.has(id))) {
      throw new BadRequestException("Reorder list must include every attached media usage");
    }

    try {
      await this.prisma.$transaction(
        ids.map((id, index) =>
          this.prisma.mediaUsage.update({ where: { id }, data: { sortOrder: index } }),
        ),
      );
    } catch (error) {
      throwMappedPrisma(error, "Could not reorder media");
    }
    return this.listMediaForEntity(usageType, entityId);
  }

  async deletionCheck(mediaIdRaw: string) {
    const mediaId = parseMediaId(mediaIdRaw);
    await this.requireMedia(mediaId);
    const usages = await this.listUsagesForMedia(mediaId);
    return {
      mediaId,
      inUse: usages.length > 0,
      count: usages.length,
      usages,
    };
  }

  /**
   * One primary attachment per entity: extras are detached, the GalleryImage is never deleted.
   * `mediaId: null` removes every usage for that entity.
   */
  async setPrimary(input: { usageType: string; entityId: string; mediaId: string | null }) {
    const usageType = parseUsageType(input.usageType);
    const entityId = parseEntityId(input.entityId);

    if (input.mediaId === null) {
      await this.prisma.mediaUsage.deleteMany({ where: { usageType, entityId } });
      return null;
    }

    const mediaId = parseMediaId(input.mediaId);
    const media = await this.prisma.galleryImage.findUnique({
      where: { id: mediaId },
      select: mediaAssetSelect,
    });
    if (!media) throw new NotFoundException("Gallery image not found");
    if (!media.isActive) {
      throw new BadRequestException("This media is not available");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.mediaUsage.deleteMany({
          where: { usageType, entityId, NOT: { mediaId } },
        });
        const current = await tx.mediaUsage.findUnique({
          where: { mediaId_usageType_entityId: { mediaId, usageType, entityId } },
          select: usageWithMediaSelect,
        });
        if (current) {
          if (current.sortOrder === 0) return current;
          return tx.mediaUsage.update({
            where: { id: current.id },
            data: { sortOrder: 0 },
            select: usageWithMediaSelect,
          });
        }
        return tx.mediaUsage.create({
          data: { mediaId, usageType, entityId, sortOrder: 0 },
          select: usageWithMediaSelect,
        });
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        const reused = await this.findUsage(mediaId, usageType, entityId);
        if (reused) return reused;
      }
      throwMappedPrisma(error, "Could not attach media");
    }
  }

  async primariesForEntities(usageTypeRaw: string, entityIdsRaw: string[]) {
    const usageType = parseUsageType(usageTypeRaw);
    const entityIds = [...new Set(entityIdsRaw.map((id) => parseEntityId(id)))];
    const rows = await this.prisma.mediaUsage.findMany({
      where: { usageType, entityId: { in: entityIds } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: usageWithMediaSelect,
    });
    const map = new Map<string, (typeof rows)[number]["media"]>();
    for (const row of rows) {
      if (!map.has(row.entityId)) map.set(row.entityId, row.media);
    }
    return map;
  }

  private async requireMedia(mediaId: string) {
    const media = await this.prisma.galleryImage.findUnique({
      where: { id: mediaId },
      select: { id: true },
    });
    if (!media) throw new NotFoundException("Gallery image not found");
    return media;
  }

  private findUsage(mediaId: string, usageType: MediaUsageType, entityId: string) {
    return this.prisma.mediaUsage.findUnique({
      where: { mediaId_usageType_entityId: { mediaId, usageType, entityId } },
      select: usageWithMediaSelect,
    });
  }

  private async nextSortOrder(usageType: MediaUsageType, entityId: string) {
    const max = await this.prisma.mediaUsage.aggregate({
      where: { usageType, entityId },
      _max: { sortOrder: true },
    });
    return (max._max.sortOrder ?? -1) + 1;
  }
}

function throwMappedPrisma(error: unknown, fallback: string): never {
  const code = (error as { code?: string }).code;
  if (code === "P2003") {
    throw new NotFoundException("Gallery image not found");
  }
  if (code === "P2025") {
    throw new NotFoundException("Media usage not found");
  }
  if (typeof code === "string" && code.startsWith("P")) {
    throw new BadRequestException(fallback);
  }
  throw error;
}
