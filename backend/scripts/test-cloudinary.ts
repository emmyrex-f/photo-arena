import * as dotenv from "dotenv";
import * as path from "path";
import { v2 as cloudinary } from "cloudinary";

// Load backend/.env first, then root .env
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function run() {
  console.log("\n==========================================");
  console.log("☁️  CLOUDINARY CONNECTION & STORAGE TEST");
  console.log("==========================================\n");

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();
  const folder = process.env.CLOUDINARY_FOLDER?.trim() || "photo-arena";

  console.log("Configuration Check:");
  console.log(`- STORAGE_PROVIDER: ${process.env.STORAGE_PROVIDER || "cloudinary"}`);
  console.log(`- CLOUDINARY_CLOUD_NAME: ${cloudName ? cloudName : "❌ [NOT SET]"}`);
  console.log(`- CLOUDINARY_API_KEY: ${apiKey ? apiKey.slice(0, 4) + "..." + apiKey.slice(-3) : "❌ [NOT SET]"}`);
  console.log(`- CLOUDINARY_API_SECRET: ${apiSecret ? "••••••••" + apiSecret.slice(-4) : "❌ [NOT SET]"}`);
  console.log(`- CLOUDINARY_URL: ${cloudinaryUrl ? "configured (hidden)" : "❌ [NOT SET]"}`);
  console.log(`- CLOUDINARY_FOLDER: ${folder}\n`);

  if (!cloudinaryUrl && (!cloudName || !apiKey || !apiSecret)) {
    console.error("❌ Cloudinary credentials are missing in backend/.env!");
    console.error("\nPlease add your credentials to backend/.env (or .env):");
    console.error(`
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
# Or:
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
`);
    process.exit(1);
  }

  if (cloudinaryUrl) {
    cloudinary.config({
      cloudinary_url: cloudinaryUrl,
      secure: true,
    });
  } else {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  try {
    console.log("1️⃣ Testing Cloudinary API authentication (ping & usage)...");
    const pingResult = await cloudinary.api.ping();
    console.log("   ✅ Ping successful:", pingResult);

    try {
      const usageResult = await cloudinary.api.usage();
      console.log("   ✅ Usage info:", {
        plan: usageResult.plan,
        credits: usageResult.credits,
        media_limits: usageResult.media_limits,
      });
    } catch (uErr: any) {
      console.log("   ⚠️ Usage check warning:", uErr?.message);
    }

    console.log("\n2️⃣ Testing Upload (1x1 PNG sample image)...");
    const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const testPublicId = `${folder}/_connection_test_${Date.now()}`;
    
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      public_id: testPublicId,
      resource_type: "image",
      overwrite: true,
    });

    console.log("   ✅ Upload successful!");
    console.log(`   - Public ID: ${uploadResult.public_id}`);
    console.log(`   - URL: ${uploadResult.secure_url || uploadResult.url}`);
    console.log(`   - Bytes: ${uploadResult.bytes}`);
    console.log(`   - Format: ${uploadResult.format}`);

    console.log("\n3️⃣ Testing Cleanup (destroy test image)...");
    const deleteResult = await cloudinary.uploader.destroy(testPublicId, {
      resource_type: "image",
      invalidate: true,
    });
    console.log("   ✅ Cleanup successful:", deleteResult);

    console.log("\n🎉 ALL TESTS PASSED! Cloudinary is fully connected and ready for uploads.\n");
  } catch (err: any) {
    console.error("\n❌ Cloudinary Test Failed!");
    const errMsg = err?.message || err?.error?.message || String(err);
    console.error("Error message:", errMsg);

    if (errMsg.includes('missing permissions') || errMsg.includes('actions=["create"]')) {
      console.error("\n🔑 DIAGNOSIS: The API Key has restricted permissions in Cloudinary.");
      console.error("1. Go to Cloudinary Console (https://console.cloudinary.com)");
      console.error("2. Go to Settings ⚙️ → Access Keys");
      console.error("3. Ensure the Access Key has 'Upload / Create' permissions enabled, or copy the Master API Key & Secret.");
    }
    process.exit(1);
  }
}

run();
