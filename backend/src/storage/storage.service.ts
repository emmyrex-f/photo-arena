import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { uploadsRoot } from "../common/utils";
import { CloudinaryStorageProvider } from "./cloudinary-storage.provider";
import { LocalStorageProvider } from "./local-storage.provider";
import { R2StorageProvider } from "./r2-storage.provider";
import { IStorageProvider } from "./storage-provider.interface";
import {
  StorageIntegrationStatus,
  StorageProviderType,
  StorageUploadInput,
  StorageUploadResult,
} from "./storage.types";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    private readonly cloudinaryProvider: CloudinaryStorageProvider,
    private readonly localProvider: LocalStorageProvider,
    private readonly r2Provider: R2StorageProvider,
  ) {}

  getActiveProviderName(): StorageProviderType {
    const configured = (this.config.get<string>("STORAGE_PROVIDER") ?? "cloudinary").trim().toLowerCase();
    if (configured === "r2" || configured === "s3") {
      return "r2";
    }
    if (configured === "local") {
      return "local";
    }
    return "cloudinary";
  }

  getActiveProvider(): IStorageProvider {
    const providerName = this.getActiveProviderName();
    if (providerName === "cloudinary") {
      if (!this.cloudinaryProvider.isConfigured()) {
        const isProd = this.config.get<string>("NODE_ENV") === "production";
        if (isProd) {
          this.logger.error("STORAGE_PROVIDER=cloudinary is set but Cloudinary credentials are incomplete in production!");
        } else {
          this.logger.warn(
            "STORAGE_PROVIDER=cloudinary is active but Cloudinary keys (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET or CLOUDINARY_URL) are not set. Falling back to local disk storage.",
          );
          return this.localProvider;
        }
      }
      return this.cloudinaryProvider;
    }
    if (providerName === "r2") {
      if (!this.r2Provider.isConfigured()) {
        const isProd = this.config.get<string>("NODE_ENV") === "production";
        if (isProd) {
          this.logger.error("STORAGE_PROVIDER=r2 is set but R2 credentials are incomplete in production!");
        } else {
          this.logger.warn(
            "STORAGE_PROVIDER=r2 is set but R2 credentials are not fully configured. Using R2 provider (uploads will fail if keys missing).",
          );
        }
      }
      return this.r2Provider;
    }
    return this.localProvider;
  }

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const provider = this.getActiveProvider();
    return provider.upload(input);
  }

  getPresignedUpload(input: import("./storage.types").PresignedUploadInput): import("./storage.types").PresignedUploadParams {
    const activeProvider = this.getActiveProviderName();
    if (activeProvider === "cloudinary" && this.cloudinaryProvider.isConfigured()) {
      return this.cloudinaryProvider.getPresignedUpload(input);
    }
    return {
      provider: activeProvider,
      uploadUrl: "/api/admin/gallery/upload",
      resourceType: input.resourceType || "auto",
      direct: false,
    };
  }

  async delete(url: string, thumbUrl?: string | null): Promise<void> {
    // If the image is a local upload path, delete via local provider
    if (url.startsWith("/uploads/")) {
      await this.localProvider.delete(url, thumbUrl);
      return;
    }
    // If it's a Cloudinary URL or active provider is Cloudinary
    if (url.includes("res.cloudinary.com") || this.getActiveProviderName() === "cloudinary") {
      await this.cloudinaryProvider.delete(url, thumbUrl);
      return;
    }
    // If it's a remote URL (R2/S3) or if active provider is R2, delete via R2
    if (this.getActiveProviderName() === "r2" || /^https?:\/\//i.test(url)) {
      await this.r2Provider.delete(url, thumbUrl);
      return;
    }
    await this.localProvider.delete(url, thumbUrl);
  }

  getIntegrationStatus(): StorageIntegrationStatus {
    const configured = (this.config.get<string>("STORAGE_PROVIDER") ?? "cloudinary").trim().toLowerCase();
    const active = this.getActiveProviderName();
    const r2Status = this.r2Provider.getStatus();
    const cloudinaryStatus = this.cloudinaryProvider.getStatus();

    return {
      provider: active,
      configuredProvider: configured,
      isCloudinaryConfigured: this.cloudinaryProvider.isConfigured(),
      cloudName: cloudinaryStatus.cloudName ?? null,
      isR2Configured: this.r2Provider.isConfigured(),
      bucket: r2Status.bucket ?? null,
      publicUrl: r2Status.publicUrl ?? null,
      endpoint: r2Status.endpoint ?? null,
      uploadsDir: uploadsRoot(),
    };
  }
}

