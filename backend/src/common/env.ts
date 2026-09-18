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
  }
}
