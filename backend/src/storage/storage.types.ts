import { MediaKind } from "@prisma/client";

export type StorageProviderType = "cloudinary" | "r2" | "local";

export interface StorageUploadInput {
  buffer: Buffer;
  filename: string;
  thumbBuffer?: Buffer;
  thumbFilename?: string;
  kind: MediaKind;
  contentType?: string;
}

export interface StorageUploadResult {
  url: string;
  thumbUrl?: string;
  provider: StorageProviderType;
}

export interface StorageIntegrationStatus {
  provider: StorageProviderType;
  configuredProvider: string;
  isCloudinaryConfigured?: boolean;
  cloudName?: string | null;
  isR2Configured: boolean;
  bucket: string | null;
  publicUrl: string | null;
  endpoint: string | null;
  uploadsDir: string;
}

export interface PresignedUploadInput {
  kind: MediaKind;
  filename: string;
  contentType?: string;
  resourceType?: "image" | "video" | "auto";
}

export interface PresignedUploadParams {
  provider: StorageProviderType;
  uploadUrl: string;
  fields?: Record<string, string | number>;
  publicId?: string;
  folder?: string;
  resourceType?: "image" | "video" | "auto";
  direct: boolean;
}

