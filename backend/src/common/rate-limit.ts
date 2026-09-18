import { HttpException, HttpStatus } from "@nestjs/common";

type Window = { times: number[] };

/** Single-process in-memory limiter. Documented: one Node process on the VPS. */
export class MemoryRateLimiter {
  private readonly buckets = new Map<string, Window>();

  /** Returns true if the event is allowed and recorded. */
  hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const window = this.buckets.get(key) ?? { times: [] };
    window.times = window.times.filter((t) => now - t < windowMs);
    if (window.times.length >= limit) {
      this.buckets.set(key, window);
      return false;
    }
    window.times.push(now);
    this.buckets.set(key, window);
    return true;
  }

  /** Count without recording (e.g. check failures before attempting login). */
  count(key: string, windowMs: number, now = Date.now()): number {
    const window = this.buckets.get(key);
    if (!window) return 0;
    window.times = window.times.filter((t) => now - t < windowMs);
    this.buckets.set(key, window);
    return window.times.length;
  }

  record(key: string, windowMs: number, now = Date.now()): void {
    const window = this.buckets.get(key) ?? { times: [] };
    window.times = window.times.filter((t) => now - t < windowMs);
    window.times.push(now);
    this.buckets.set(key, window);
  }

  clear(key: string): void {
    this.buckets.delete(key);
  }
}

export const rateLimiter = new MemoryRateLimiter();

export const RATE_WINDOW_MS = 15 * 60 * 1000;
export const HOLD_IP_LIMIT = 10;
export const HOLD_PHONE_LIMIT = 5;
export const HOLD_ACTIVE_PER_PHONE = 3;
export const LOGIN_FAIL_LIMIT = 5;

export function rateLimitPhoneKey(phone: string): string {
  return phone.replace(/\D/g, "") || phone.trim();
}

export function tooManyRequests(message = "Too many requests. Try again later."): never {
  throw new HttpException({ statusCode: 429, message, error: "Too Many Requests" }, HttpStatus.TOO_MANY_REQUESTS);
}
