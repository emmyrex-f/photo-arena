import { Injectable, Logger } from "@nestjs/common";
import { promises as fs } from "fs";
import { join } from "path";
import {
  absoluteUploadPath,
  assertInsideUploads,
  kindDirFor,
  publicUploadPath,
} from "../common/upload-path";
import { ensureUploadsDir, uploadsRoot } from "../common/utils";
import { IStorageProvider } from "./storage-provider.interface";
import { StorageIntegrationStatus, StorageUploadInput, StorageUploadResult } from "./storage.types";

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  readonly name = "local" as const;
  private readonly logger = new Logger(LocalStorageProvider.name);

  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    const kindDir = kindDirFor(input.kind);
    ensureUploadsDir();
    const dir = assertInsideUploads(join(uploadsRoot(), kindDir));
    await fs.mkdir(dir, { recursive: true });

    const fullPath = assertInsideUploads(join(dir, input.filename));
    await fs.writeFile(fullPath, input.buffer);

    let thumbUrl: string | undefined;
    if (input.thumbBuffer && input.thumbFilename) {
      const thumbPath = assertInsideUploads(join(dir, input.thumbFilename));
      await fs.writeFile(thumbPath, input.thumbBuffer);
      thumbUrl = publicUploadPath(input.kind, input.thumbFilename);
    }

    return {
      url: publicUploadPath(input.kind, input.filename),
      thumbUrl,
      provider: "local",
    };
  }

  async delete(url: string, thumbUrl?: string | null): Promise<void> {
    for (const path of [url, thumbUrl]) {
      if (!path) continue;
      const abs = absoluteUploadPath(path);
      if (abs) {
        await fs.unlink(abs).catch((err) => {
          this.logger.debug(`Could not unlink local file ${abs}: ${err?.message}`);
        });
      }
    }
  }

  getStatus(): Partial<StorageIntegrationStatus> {
    return {
      provider: "local",
      uploadsDir: uploadsRoot(),
    };
  }
}
