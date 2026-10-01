import { StorageIntegrationStatus, StorageProviderType, StorageUploadInput, StorageUploadResult } from "./storage.types";

export interface IStorageProvider {
  readonly name: StorageProviderType;
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  delete(url: string, thumbUrl?: string | null): Promise<void>;
  getStatus(): Partial<StorageIntegrationStatus>;
}
