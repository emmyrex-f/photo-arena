import { Module } from "@nestjs/common";
import { CloudinaryStorageProvider } from "./cloudinary-storage.provider";
import { LocalStorageProvider } from "./local-storage.provider";
import { R2StorageProvider } from "./r2-storage.provider";
import { StorageService } from "./storage.service";

@Module({
  providers: [CloudinaryStorageProvider, LocalStorageProvider, R2StorageProvider, StorageService],
  exports: [StorageService],
})
export class StorageModule {}

