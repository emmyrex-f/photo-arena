import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { uploadsRoot } from "../common/utils";
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
    private readonly config: ConfigService,
    private readonly localProvider: LocalStorageProvider,
    private readonly r2Provider: R2StorageProvider,
  ) {}

  getActiveProviderName(): StorageProviderType {
    const configured = (this.config.get<string>("STORAGE_PROVIDER") ?? "local").trim().toLowerCase();
    if (configured === "r2" || configured === "s3") {
      return "r2";
    }
    return "local";
  }

  getActiveProvider(): IStorageProvider {
    const providerName = this.getActiveProviderName();
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

  async delete(url: string, thumbUrl?: string | null): Promise<void> {
    // If the image is a local upload path, delete via local provider
    if (url.startsWith("/uploads/")) {
      await this.localProvider.delete(url, thumbUrl);
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
    const configured = (this.config.get<string>("STORAGE_PROVIDER") ?? "local").trim().toLowerCase();
    const active = this.getActiveProviderName();
    const r2Status = this.r2Provider.getStatus();

    return {
      provider: active,
      configuredProvider: configured,
      isR2Configured: this.r2Provider.isConfigured(),
      bucket: r2Status.bucket ?? null,
      publicUrl: r2Status.publicUrl ?? null,
      endpoint: r2Status.endpoint ?? null,
      uploadsDir: uploadsRoot(),
    };
  }
}
