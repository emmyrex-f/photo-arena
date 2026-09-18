import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { DeskPermission } from "../auth/permissions";
import { hasDeskPermission } from "../auth/permissions";
import type { AuthUser } from "../auth/auth.types";

/** Generic usage labels. Callers map these to CMS entities; this layer does not load those records. */
export const MEDIA_USAGE_TYPES = [
  "service",
  "homepage_gallery",
  "portfolio",
  "blog",
  "content",
  "testimonial",
] as const;

export type MediaUsageType = (typeof MEDIA_USAGE_TYPES)[number];

const USAGE_TYPE_PERMISSION: Record<MediaUsageType, DeskPermission> = {
  service: "services",
  homepage_gallery: "gallery",
  portfolio: "gallery",
  blog: "content",
  content: "content",
  testimonial: "testimonials",
};

const IDENTIFIER = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

export const mediaAssetSelect = {
  id: true,
  filename: true,
  url: true,
  thumbUrl: true,
  width: true,
  height: true,
  kind: true,
  category: true,
  alt: true,
  sortOrder: true,
  featured: true,
  isActive: true,
  createdAt: true,
} as const;

export function isMediaUsageType(value: string): value is MediaUsageType {
  return (MEDIA_USAGE_TYPES as readonly string[]).includes(value);
}

export function parseUsageType(raw: string): MediaUsageType {
  const value = raw.trim().toLowerCase();
  if (!isMediaUsageType(value)) {
    throw new BadRequestException("Invalid media usage type");
  }
  return value;
}

export function parseEntityId(raw: string): string {
  const value = raw.trim();
  if (!IDENTIFIER.test(value)) {
    throw new BadRequestException("Invalid entity id");
  }
  return value;
}

export function parseMediaId(raw: string): string {
  const value = raw.trim();
  if (!IDENTIFIER.test(value)) {
    throw new BadRequestException("Invalid media id");
  }
  return value;
}

export function permissionForUsageType(usageType: MediaUsageType): DeskPermission {
  return USAGE_TYPE_PERMISSION[usageType];
}

export function assertCanAccessUsageType(user: AuthUser, usageType: MediaUsageType): void {
  if (!hasDeskPermission(user, permissionForUsageType(usageType))) {
    throw new ForbiddenException("You do not have access to this area");
  }
}
