/**
 * Fail closed in production when critical config is missing or weak.
 * Call once at process boot, before listening.
 */
export function assertCriticalEnv(env: NodeJS.ProcessEnv = process.env): void {
  const production = env.NODE_ENV === "production";
  const jwt = (env.JWT_SECRET ?? "").trim();
  if (!jwt) {
    throw new Error("JWT_SECRET is required");
  }
  if (production) {
    if (jwt.length < 32 || jwt === "change-me" || jwt === "changeme") {
      throw new Error("JWT_SECRET must be a strong secret of at least 32 characters in production");
    }
    const origins = (env.PUBLIC_SITE_ORIGINS ?? "").trim();
    if (!origins) {
      throw new Error("PUBLIC_SITE_ORIGINS is required in production (comma-separated https origins)");
    }
    for (const origin of origins.split(",")) {
      const value = origin.trim();
      if (!value) continue;
      if (!value.startsWith("https://")) {
        throw new Error(`PUBLIC_SITE_ORIGINS must use https in production (got ${value})`);
      }
    }

    const storageProvider = (env.STORAGE_PROVIDER ?? "local").trim().toLowerCase();
    if (storageProvider === "r2" || storageProvider === "s3") {
      const hasKey = Boolean(env.R2_ACCESS_KEY_ID || env.S3_ACCESS_KEY_ID);
      const hasSecret = Boolean(env.R2_SECRET_ACCESS_KEY || env.S3_SECRET_ACCESS_KEY);
      const hasBucket = Boolean(env.R2_BUCKET || env.S3_BUCKET);
      const hasEndpoint = Boolean(env.R2_ACCOUNT_ID || env.R2_ENDPOINT || env.S3_ENDPOINT);
      if (!hasKey || !hasSecret || !hasBucket || !hasEndpoint) {
        throw new Error(
          "STORAGE_PROVIDER=r2 in production requires R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_ACCOUNT_ID (or R2_ENDPOINT)",
        );
      }
    }

    const hasResend = Boolean((env.RESEND_API_KEY ?? "").trim());
    const hasSmtp = Boolean((env.SMTP_HOST ?? "").trim());
    if (!hasResend && !hasSmtp) {
      throw new Error(
        "Production requires email delivery: set RESEND_API_KEY (preferred) or SMTP_HOST/SMTP_USER/SMTP_PASS",
      );
    }
  }
}
