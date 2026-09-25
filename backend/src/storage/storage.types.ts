import { MediaKind } from "@prisma/client";

export type StorageProviderType = "local" | "r2";

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
  isR2Configured: boolean;
  bucket: string | null;
  publicUrl: string | null;
  endpoint: string | null;
  uploadsDir: string;
}
