import { ApiError } from "../../lib/api";
import type { MediaUsage } from "./types";

export type MediaInUseConflict = {
  message: string;
  count: number;
  usages: MediaUsage[];
};

function asUsage(raw: unknown): MediaUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.usageType !== "string" || typeof row.entityId !== "string") return null;
  return {
    id: typeof row.id === "string" ? row.id : "",
    mediaId: typeof row.mediaId === "string" ? row.mediaId : "",
    usageType: row.usageType,
    entityId: row.entityId,
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : 0,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
  };
}

/** 409 from DELETE /admin/gallery/:id when MediaUsage rows still exist. */
export function mediaInUseFromError(err: unknown): MediaInUseConflict | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const body = err.body;
  if (!body || typeof body !== "object") {
    return { message: err.message, count: 0, usages: [] };
  }
  const rec = body as Record<string, unknown>;
  const usages = Array.isArray(rec.usages)
    ? rec.usages.map(asUsage).filter((row): row is MediaUsage => Boolean(row))
    : [];
  const count = typeof rec.count === "number" ? rec.count : usages.length;
  const message =
    typeof rec.message === "string" && rec.message
      ? rec.message
      : "This asset cannot be deleted while it is attached elsewhere.";
  return { message, count, usages };
}
