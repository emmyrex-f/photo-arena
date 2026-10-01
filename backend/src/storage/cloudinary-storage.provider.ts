import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { promises as fs } from "fs";
import { absoluteUploadPath, kindDirFor } from "../common/upload-path";
import { IStorageProvider } from "./storage-provider.interface";
import { StorageIntegrationStatus, StorageUploadInput, StorageUploadResult } from "./storage.types";

@Injectable()
export class CloudinaryStorageProvider implements IStorageProvider {
  readonly name = "cloudinary" as const;
  private readonly logger = new Logger(CloudinaryStorageProvider.name);
  private clientConfigured = false;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.initClient();
  }

  private initClient() {
    const cloudinaryUrl = this.config.get<string>("CLOUDINARY_URL")?.trim();
    const cloudName = this.config.get<string>("CLOUDINARY_CLOUD_NAME")?.trim();
    const apiKey = this.config.get<string>("CLOUDINARY_API_KEY")?.trim();
    const apiSecret = this.config.get<string>("CLOUDINARY_API_SECRET")?.trim();

    if (cloudinaryUrl) {
      cloudinary.config({
        cloudinary_url: cloudinaryUrl,
        secure: true,
      });
      this.clientConfigured = true;
    } else if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.clientConfigured = true;
    } else {
      this.clientConfigured = false;
    }
  }

  isConfigured(): boolean {
    if (!this.clientConfigured) {
      this.initClient();
    }
    return this.clientConfigured;
  }

  getFolder(): string {
    return this.config.get<string>("CLOUDINARY_FOLDER")?.trim() || "photo-arena";
  }

  getCloudName(): string | null {
    const cloudName = this.config.get<string>("CLOUDINARY_CLOUD_NAME")?.trim();
    if (cloudName) return cloudName;
    const url = this.config.get<string>("CLOUDINARY_URL")?.trim();
    if (url) {
      const match = url.match(/@([^/?#]+)/);
      if (match) return match[1];
    }
    return null;
  }

  getApiKey(): string | null {
    const key = this.config.get<string>("CLOUDINARY_API_KEY")?.trim();
    if (key) return key;
    const url = this.config.get<string>("CLOUDINARY_URL")?.trim();
    if (url) {
      const match = url.match(/cloudinary:\/\/([^:]+):/);
      if (match) return match[1];
    }
    return null;
  }

  getApiSecret(): string | null {
    const secret = this.config.get<string>("CLOUDINARY_API_SECRET")?.trim();
    if (secret) return secret;
    const url = this.config.get<string>("CLOUDINARY_URL")?.trim();
    if (url) {
      const match = url.match(/cloudinary:\/\/[^:]+:([^@]+)@/);
      if (match) return match[1];
    }
    return null;
  }

  getPresignedUpload(input: {
    kind: any;
    filename: string;
    contentType?: string;
    resourceType?: "image" | "video" | "auto";
  }) {
    if (!this.isConfigured()) {
      throw new Error("Cloudinary is not configured");
    }

    const cloudName = this.getCloudName();
    const apiKey = this.getApiKey();
    const apiSecret = this.getApiSecret();
    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error("Cloudinary credentials incomplete");
    }

    const baseFolder = this.getFolder();
    const kindDir = kindDirFor(input.kind);
    const folder = `${baseFolder}/${kindDir}`;

    const filenameNoExt = input.filename.replace(/\.[^/.]+$/, "");
    const resourceType = input.resourceType || this.getResourceType(input.kind, input.contentType);
    const timestamp = Math.floor(Date.now() / 1000);

    const paramsToSign: Record<string, any> = {
      folder,
      public_id: filenameNoExt,
      timestamp,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return {
      provider: "cloudinary" as const,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      fields: {
        api_key: apiKey,
        timestamp,
        folder,
        public_id: filenameNoExt,
        signature,
      },
      publicId: `${folder}/${filenameNoExt}`,
      folder,
      resourceType,
      direct: true,
    };
  }

  private uploadBuffer(
    buffer: Buffer,
    folder: string,
    publicId: string,
    resourceType: "auto" | "image" | "video" = "auto",
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: resourceType,
          overwrite: true,
          use_filename: false,
          unique_filename: false,
        },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error("Cloudinary upload failed with empty result"));
          }
          resolve(result);
        },
      );
      uploadStream.end(buffer);
    });
  }

  private getResourceType(kind: string, contentType?: string): "auto" | "image" | "video" {
    if (contentType?.startsWith("video/")) return "video";
    if (contentType?.startsWith("image/")) return "image";
    if (kind.toLowerCase().includes("video") || kind.toLowerCase().includes("reel")) return "video";
    return "auto";
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    if (!this.isConfigured()) {
      throw new Error(
        "Cloudinary storage is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (or CLOUDINARY_URL).",
      );
    }

    const baseFolder = this.getFolder();
    const kindDir = kindDirFor(input.kind);
    const targetFolder = `${baseFolder}/${kindDir}`;
    // Remove extension for public_id cleanly
    const filenameNoExt = input.filename.replace(/\.[^/.]+$/, "");
    const resourceType = this.getResourceType(input.kind, input.contentType);

    const mainResult = await this.uploadBuffer(input.buffer, targetFolder, filenameNoExt, resourceType);

    let thumbUrl: string | undefined;
    if (input.thumbBuffer && input.thumbFilename) {
      const thumbNoExt = input.thumbFilename.replace(/\.[^/.]+$/, "");
      const thumbResult = await this.uploadBuffer(input.thumbBuffer, targetFolder, thumbNoExt, "image");
      thumbUrl = thumbResult.secure_url || thumbResult.url;
    } else if (mainResult.resource_type === "image") {
      thumbUrl = cloudinary.url(mainResult.public_id, {
        secure: true,
        transformation: [{ width: 600, crop: "fill", quality: "auto", fetch_format: "auto" }],
      });
    }

    return {
      url: mainResult.secure_url || mainResult.url,
      thumbUrl,
      provider: "cloudinary",
    };
  }

  private extractPublicIdFromUrl(url: string): { publicId: string; resourceType: "image" | "video" | "raw" } | null {
    if (!url || !url.includes("res.cloudinary.com")) return null;
    try {
      const uploadIdx = url.indexOf("/upload/");
      if (uploadIdx === -1) return null;

      const prefix = url.substring(0, uploadIdx);
      const resourceTypeMatch = prefix.match(/\/(image|video|raw)$/);
      const resourceType: "image" | "video" | "raw" = (resourceTypeMatch?.[1] as any) || "image";

      const afterUpload = url.substring(uploadIdx + "/upload/".length);
      const segments = afterUpload.split("/");

      let startIndex = 0;
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        if (/^v\d+$/.test(seg)) {
          startIndex = i + 1;
          break;
        }
        if (seg.includes(",") || /^[a-z]{1,3}_/.test(seg)) {
          startIndex = i + 1;
        }
      }

      const pathWithExt = segments.slice(startIndex).join("/");
      const publicId = pathWithExt.replace(/\.[^/.]+$/, "");
      if (!publicId) return null;

      return { publicId, resourceType };
    } catch {
      return null;
    }
  }

  async delete(url: string, thumbUrl?: string | null): Promise<void> {
    if (!this.isConfigured()) return;

    for (const targetUrl of [url, thumbUrl]) {
      if (!targetUrl) continue;

      // Handle legacy local path gracefully
      if (targetUrl.startsWith("/uploads/")) {
        const abs = absoluteUploadPath(targetUrl);
        if (abs) {
          await fs.unlink(abs).catch(() => undefined);
        }
        continue;
      }

      const parsed = this.extractPublicIdFromUrl(targetUrl);
      if (parsed?.publicId) {
        await cloudinary.uploader
          .destroy(parsed.publicId, {
            resource_type: parsed.resourceType || "image",
            invalidate: true,
          })
          .catch((err) => {
            this.logger.warn(`Failed to destroy Cloudinary asset (${parsed.publicId}): ${err?.message}`);
          });
      }
    }
  }

  getStatus(): Partial<StorageIntegrationStatus> {
    return {
      provider: "cloudinary",
      isCloudinaryConfigured: this.isConfigured(),
      cloudName: this.getCloudName(),
    };
  }
}
