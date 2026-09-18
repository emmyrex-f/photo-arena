const DEV_DEFAULT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const ALLOWED_PATHS_RETURN = ["/book/confirmation"];
const ALLOWED_PATHS_CANCEL = ["/book"];

export function configuredOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = (env.PUBLIC_SITE_ORIGINS ?? "").trim();
  const listed = raw
    ? raw.split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean)
    : [];
  if (env.NODE_ENV === "production") {
    return [...new Set(listed)];
  }
  return [...new Set([...DEV_DEFAULT_ORIGINS, ...listed])];
}

function isLocalhostHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * Bachs hosted checkout rejects loopback `success_url` / `cancel_url`
 * (`VALIDATION_ERROR`: "success_url must be a publicly accessible URL (localhost is not allowed)").
 * Those fields are optional on `POST /v1/checkout-sessions`. Return the URL only when Bachs will
 * accept it; otherwise omit it. Our allowlist still runs first — this never widens where the
 * customer is allowed to send us. The webhook / server-side verify remain payment authority.
 */
export function bachsHostedRedirectUrl(validatedUrl: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(validatedUrl);
  } catch {
    return undefined;
  }
  if (isLocalhostHostname(parsed.hostname)) return undefined;
  return validatedUrl;
}

export function originAllowed(origin: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const allowed = configuredOrigins(env);
  return allowed.includes(origin);
}

export function trustedHostnames(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const hosts = new Set<string>(["localhost", "127.0.0.1", "[::1]"]);
  for (const origin of configuredOrigins(env)) {
    try {
      hosts.add(new URL(origin).hostname.toLowerCase());
    } catch {
      /* skip invalid */
    }
  }
  const api = (env.PUBLIC_API_URL ?? "").trim();
  if (api) {
    try {
      hosts.add(new URL(api).hostname.toLowerCase());
    } catch {
      /* skip */
    }
  }
  for (const extra of (env.TRUSTED_HOSTS ?? "").split(",")) {
    const host = extra.trim().toLowerCase();
    if (host) hosts.add(host);
  }
  return hosts;
}

export function isTrustedHostHeader(hostHeader: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!hostHeader) return env.NODE_ENV !== "production";
  const hostname = hostHeader.split(":")[0]?.trim().toLowerCase() ?? "";
  return trustedHostnames(env).has(hostname);
}

/** Guest checkout return/cancel URLs must match the public site, not an arbitrary host. */
export function assertCheckoutRedirectUrl(
  raw: string,
  kind: "return" | "cancel",
  env: NodeJS.ProcessEnv = process.env,
): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid checkout URL");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Checkout URL must not include credentials");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Checkout URL must be http or https");
  }

  const production = env.NODE_ENV === "production";
  if (production && parsed.protocol !== "https:") {
    throw new Error("Checkout URL must use https");
  }
  if (!production && parsed.protocol === "http:" && !isLocalhostHostname(parsed.hostname)) {
    throw new Error("Non-local checkout URLs must use https");
  }

  const origin = parsed.origin;
  if (!originAllowed(origin, env)) {
    throw new Error("Checkout URL origin is not allowed");
  }

  const path = parsed.pathname.replace(/\/$/, "") || "/";
  const allowedPaths = kind === "return" ? ALLOWED_PATHS_RETURN : ALLOWED_PATHS_CANCEL;
  if (!allowedPaths.includes(path)) {
    throw new Error("Checkout URL path is not allowed");
  }

  return parsed.toString();
}
