import type { Request } from "express";

export function trustProxyEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env.TRUST_PROXY ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1";
}

/**
 * Client IP for rate limits.
 * When TRUST_PROXY is on, use Express `req.ip` (single trusted hop).
 * Do not take the left-most X-Forwarded-For value ourselves — that is attacker-controlled
 * unless a reverse proxy has already replaced the header.
 */
export function getClientIp(req: Request, env: NodeJS.ProcessEnv = process.env): string {
  if (trustProxyEnabled(env) && req.ip) {
    return req.ip;
  }
  return req.socket?.remoteAddress || req.ip || "unknown";
}

export function isLoopbackIp(ip: string): boolean {
  const value = ip.replace(/^::ffff:/, "").toLowerCase();
  return value === "127.0.0.1" || value === "::1" || value === "localhost";
}
