/** Mock checkout is explicit and non-production only. Never infer mock from a missing Bachs key. */

export function isProductionEnv(env = process.env.NODE_ENV): boolean {
  return env === "production";
}

export function isPaymentsMockEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.PAYMENTS_MOCK ?? "").trim().toLowerCase();
  if (flag !== "true" && flag !== "1") return false;
  return !isProductionEnv(env.NODE_ENV);
}

export function assertProductionPaymentConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (!isProductionEnv(env.NODE_ENV)) return;

  const mockFlag = (env.PAYMENTS_MOCK ?? "").trim().toLowerCase();
  if (mockFlag === "true" || mockFlag === "1") {
    throw new Error("PAYMENTS_MOCK cannot be enabled when NODE_ENV=production");
  }

  const key = (env.BACHS_API_KEY ?? "").trim();
  if (!key) {
    throw new Error("BACHS_API_KEY is required when NODE_ENV=production");
  }
}
