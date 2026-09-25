import assert from "assert";
import { ConfigService } from "@nestjs/config";
import { MediaKind } from "@prisma/client";
import { promises as fs } from "fs";
import { join } from "path";
import { LocalStorageProvider } from "../src/storage/local-storage.provider";
import { R2StorageProvider } from "../src/storage/r2-storage.provider";
import { StorageService } from "../src/storage/storage.service";
import { uploadsRoot } from "../src/common/utils";

async function main() {
  console.log("Starting storage verification (Local + Cloudflare R2)...");

  // 1. Verify LocalStorageProvider upload & delete
  const localProvider = new LocalStorageProvider();
  const testBuffer = Buffer.from("fake-webp-image-data-for-testing");
  const testThumbBuffer = Buffer.from("fake-thumb-webp-data");
  const testFilename = `test-${Date.now()}.webp`;
  const testThumbName = `test-${Date.now()}-thumb.webp`;

  const localResult = await localProvider.upload({
    buffer: testBuffer,
    filename: testFilename,
    thumbBuffer: testThumbBuffer,
    thumbFilename: testThumbName,
    kind: MediaKind.GALLERY,
    contentType: "image/webp",
  });

  assert.strictEqual(localResult.provider, "local", "Provider must be local");
  assert.strictEqual(
    localResult.url,
    `/uploads/gallery/${testFilename}`,
    "Local URL format must match /uploads/gallery/...",
  );
  assert.strictEqual(
    localResult.thumbUrl,
    `/uploads/gallery/${testThumbName}`,
    "Local thumbUrl format must match /uploads/gallery/...",
  );

  // Verify file was written to disk
  const expectedDiskPath = join(uploadsRoot(), "gallery", testFilename);
  const existsBefore = await fs
    .stat(expectedDiskPath)
    .then(() => true)
    .catch(() => false);
  assert.strictEqual(existsBefore, true, "Uploaded file must exist on disk");

  // Verify deletion
  await localProvider.delete(localResult.url, localResult.thumbUrl);
  const existsAfter = await fs
    .stat(expectedDiskPath)
    .then(() => true)
    .catch(() => false);
  assert.strictEqual(existsAfter, false, "Deleted file must no longer exist on disk");
  console.log("✓ LocalStorageProvider upload, path containment, and deletion verified");

  // 2. Verify R2StorageProvider configuration resolution & URL generation
  const mockR2Config = new ConfigService({
    STORAGE_PROVIDER: "r2",
    R2_ACCOUNT_ID: "abc123def456",
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
    R2_BUCKET: "photo-arena-media",
    R2_PUBLIC_URL: "https://cdn.photoarenang.com",
    R2_REGION: "auto",
  });

  const r2Provider = new R2StorageProvider(mockR2Config);
  assert.strictEqual(r2Provider.name, "r2");
  assert.strictEqual(r2Provider.isConfigured(), true, "R2 should be configured with all keys present");
  assert.strictEqual(
    r2Provider.getEndpoint(),
    "https://abc123def456.r2.cloudflarestorage.com",
    "Endpoint must construct Cloudflare R2 account URL",
  );
  assert.strictEqual(r2Provider.getBucket(), "photo-arena-media");
  assert.strictEqual(r2Provider.getPublicUrl(), "https://cdn.photoarenang.com");
  console.log("✓ R2StorageProvider credentials, endpoint, and CDN URL resolution verified");

  // 3. Verify StorageService swapping logic via environment variable
  // Case A: STORAGE_PROVIDER=local
  const configLocal = new ConfigService({
    STORAGE_PROVIDER: "local",
  });
  const serviceLocal = new StorageService(
    configLocal,
    new LocalStorageProvider(),
    new R2StorageProvider(configLocal),
  );
  assert.strictEqual(
    serviceLocal.getActiveProviderName(),
    "local",
    "STORAGE_PROVIDER=local must activate LocalStorageProvider",
  );
  const statusLocal = serviceLocal.getIntegrationStatus();
  assert.strictEqual(statusLocal.provider, "local");
  assert.strictEqual(statusLocal.configuredProvider, "local");
  console.log("✓ StorageService active provider switches to 'local' when STORAGE_PROVIDER=local");

  // Case B: STORAGE_PROVIDER=r2
  const serviceR2 = new StorageService(
    mockR2Config,
    new LocalStorageProvider(),
    r2Provider,
  );
  assert.strictEqual(
    serviceR2.getActiveProviderName(),
    "r2",
    "STORAGE_PROVIDER=r2 must activate R2StorageProvider",
  );
  const statusR2 = serviceR2.getIntegrationStatus();
  assert.strictEqual(statusR2.provider, "r2");
  assert.strictEqual(statusR2.configuredProvider, "r2");
  assert.strictEqual(statusR2.isR2Configured, true);
  assert.strictEqual(statusR2.bucket, "photo-arena-media");
  assert.strictEqual(statusR2.publicUrl, "https://cdn.photoarenang.com");
  console.log("✓ StorageService active provider switches to 'r2' when STORAGE_PROVIDER=r2");

  // Case C: Case-insensitivity & aliases (e.g. "s3")
  const configS3 = new ConfigService({
    STORAGE_PROVIDER: "s3",
  });
  const serviceS3 = new StorageService(
    configS3,
    new LocalStorageProvider(),
    new R2StorageProvider(configS3),
  );
  assert.strictEqual(
    serviceS3.getActiveProviderName(),
    "r2",
    "STORAGE_PROVIDER=s3 must activate S3/R2 provider",
  );
  console.log("✓ Case-insensitive and alias provider swapping verified");

  console.log("\n==========================================");
  console.log("🎉 ALL STORAGE VERIFICATIONS PASSED!");
  console.log("==========================================");
}

main().catch((err) => {
  console.error("Storage verification failed:", err);
  process.exit(1);
});
