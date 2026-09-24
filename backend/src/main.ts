import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { extname } from "path";
import { AppModule } from "./app.module";
import { trustProxyEnabled } from "./common/client-ip";
import { assertCriticalEnv } from "./common/env";
import { assertProductionPaymentConfig } from "./common/payments-mock";
import { corsOptions } from "./common/site-origins";
import { ensureUploadsDir, uploadsRoot } from "./common/utils";

function uploadContentType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  return "application/octet-stream";
}

async function bootstrap() {
  process.env.TZ = process.env.TZ ?? "Africa/Lagos";
  assertCriticalEnv();
  assertProductionPaymentConfig();
  ensureUploadsDir();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  if (trustProxyEnabled()) {
    app.set("trust proxy", 1);
  }
  // SEC-H3 / SEC-M2: allowlist only — never reflect arbitrary Origin (no origin: true).
  app.enableCors(corsOptions());
  app.useStaticAssets(uploadsRoot(), {
    prefix: "/uploads",
    setHeaders: (res, filePath) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Type", uploadContentType(filePath));
    },
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
}

void bootstrap();
