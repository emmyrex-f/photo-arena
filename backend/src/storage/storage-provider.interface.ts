import { StorageIntegrationStatus, StorageUploadInput, StorageUploadResult } from "./storage.types";

export interface IStorageProvider {
  readonly name: "local" | "r2";
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  delete(url: string, thumbUrl?: string | null): Promise<void>;
  getStatus(): Partial<StorageIntegrationStatus>;
}
