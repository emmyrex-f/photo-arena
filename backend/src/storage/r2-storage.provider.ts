import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "fs";
import { absoluteUploadPath, kindDirFor } from "../common/upload-path";
import { IStorageProvider } from "./storage-provider.interface";
import { StorageIntegrationStatus, StorageUploadInput, StorageUploadResult } from "./storage.types";

@Injectable()
export class R2StorageProvider implements IStorageProvider {
  readonly name = "r2" as const;
  private readonly logger = new Logger(R2StorageProvider.name);
  private s3Client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {
    this.initClient();
  }

  private initClient() {
    const accessKeyId =
      this.config.get<string>("R2_ACCESS_KEY_ID")?.trim() ||
      this.config.get<string>("S3_ACCESS_KEY_ID")?.trim();
    const secretAccessKey =
      this.config.get<string>("R2_SECRET_ACCESS_KEY")?.trim() ||
      this.config.get<string>("S3_SECRET_ACCESS_KEY")?.trim();
    const endpoint = this.getEndpoint();

    if (accessKeyId && secretAccessKey && endpoint) {
      this.s3Client = new S3Client({
        region: this.config.get<string>("R2_REGION")?.trim() || "auto",
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
  }

  isConfigured(): boolean {
    const accessKeyId =
      this.config.get<string>("R2_ACCESS_KEY_ID")?.trim() ||
      this.config.get<string>("S3_ACCESS_KEY_ID")?.trim();
    const secretAccessKey =
      this.config.get<string>("R2_SECRET_ACCESS_KEY")?.trim() ||
      this.config.get<string>("S3_SECRET_ACCESS_KEY")?.trim();
    const bucket = this.getBucket();
    const endpoint = this.getEndpoint();
    return Boolean(accessKeyId && secretAccessKey && bucket && endpoint);
  }

  getBucket(): string {
    return (
      this.config.get<string>("R2_BUCKET")?.trim() ||
      this.config.get<string>("S3_BUCKET")?.trim() ||
      "photo-arena"
    );
  }

  getEndpoint(): string | null {
    const customEndpoint =
      this.config.get<string>("R2_ENDPOINT")?.trim() ||
      this.config.get<string>("S3_ENDPOINT")?.trim();
    if (customEndpoint) return customEndpoint;

    const accountId = this.config.get<string>("R2_ACCOUNT_ID")?.trim();
    if (accountId) {
      return `https://${accountId}.r2.cloudflarestorage.com`;
    }
    return null;
  }

  getPublicUrl(): string | null {
    const configured =
      this.config.get<string>("R2_PUBLIC_URL")?.trim() ||
      this.config.get<string>("S3_PUBLIC_URL")?.trim();
    return configured ? configured.replace(/\/$/, "") : null;
  }

  private keyToPublicUrl(key: string): string {
    const publicUrl = this.getPublicUrl();
    if (publicUrl) {
      return `${publicUrl}/${key}`;
    }
    const endpoint = this.getEndpoint();
    const bucket = this.getBucket();
    return `${endpoint}/${bucket}/${key}`;
  }

  private extractKeyFromUrl(url: string): string | null {
    const publicUrl = this.getPublicUrl();
    if (publicUrl && url.startsWith(publicUrl)) {
      return url.slice(publicUrl.length).replace(/^\/+/, "");
    }
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.replace(/^\/+/, "").split("/");
      const bucket = this.getBucket();
      if (parts[0] === bucket) {
        return parts.slice(1).join("/");
      }
      return parts.join("/");
    } catch {
      return null;
    }
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    if (!this.s3Client) {
      this.initClient();
    }
    if (!this.s3Client) {
      throw new Error(
        "R2 / S3 storage is not configured. Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY.",
      );
    }

    const bucket = this.getBucket();
    const kindDir = kindDirFor(input.kind);
    const mainKey = `${kindDir}/${input.filename}`;
    const contentType = input.contentType ?? "image/webp";

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: mainKey,
        Body: input.buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );

    let thumbUrl: string | undefined;
    if (input.thumbBuffer && input.thumbFilename) {
      const thumbKey = `${kindDir}/${input.thumbFilename}`;
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: thumbKey,
          Body: input.thumbBuffer,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      thumbUrl = this.keyToPublicUrl(thumbKey);
    }

    return {
      url: this.keyToPublicUrl(mainKey),
      thumbUrl,
      provider: "r2",
    };
  }

  async delete(url: string, thumbUrl?: string | null): Promise<void> {
    if (!this.s3Client) {
      this.initClient();
    }

    for (const targetUrl of [url, thumbUrl]) {
      if (!targetUrl) continue;

      // If legacy local path, clean up from disk gracefully
      if (targetUrl.startsWith("/uploads/")) {
        const abs = absoluteUploadPath(targetUrl);
        if (abs) {
          await fs.unlink(abs).catch(() => undefined);
        }
        continue;
      }

      const key = this.extractKeyFromUrl(targetUrl);
      if (key && this.s3Client) {
        const bucket = this.getBucket();
        await this.s3Client
          .send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
          .catch((err) => {
            this.logger.warn(`Failed to delete object from R2 (key: ${key}): ${err?.message}`);
          });
      }
    }
  }

  getStatus(): Partial<StorageIntegrationStatus> {
    return {
      provider: "r2",
      isR2Configured: this.isConfigured(),
      bucket: this.getBucket(),
      publicUrl: this.getPublicUrl(),
      endpoint: this.getEndpoint(),
    };
  }
}
