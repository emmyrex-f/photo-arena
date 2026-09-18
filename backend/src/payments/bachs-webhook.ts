import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TOLERANCE_SECONDS = 300;

export type BachsWebhookHeaders = {
  signature?: string;
  signatureV2?: string;
  timestamp?: string;
};

function toBuffer(rawBody: Buffer | string): Buffer {
  return Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
}

function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function expectedDigest(secret: string, timestamp: string, rawBody: Buffer): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest("hex");
}

function isFresh(timestampSeconds: number, toleranceSeconds: number, nowSeconds: number): boolean {
  return Math.abs(nowSeconds - timestampSeconds) <= toleranceSeconds;
}

/** Prefer X-Bachs-Signature-V2; fall back to X-Bachs-Signature + X-Bachs-Timestamp. */
export function verifyBachsWebhookSignature(
  rawBody: Buffer | string,
  secret: string,
  headers: BachsWebhookHeaders,
  options?: { toleranceSeconds?: number; nowSeconds?: number },
): boolean {
  if (!secret) return false;

  const body = toBuffer(rawBody);
  const tolerance = options?.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowSeconds = options?.nowSeconds ?? Math.floor(Date.now() / 1000);

  const v2 = headers.signatureV2?.trim();
  if (v2) {
    const pairs = v2.split(",").map((part) => part.trim()).filter(Boolean);
    const timestampPart = pairs.find((part) => part.startsWith("t="));
    if (!timestampPart) return false;
    const timestamp = timestampPart.slice(2);
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || !isFresh(ts, tolerance, nowSeconds)) return false;

    const expected = expectedDigest(secret, timestamp, body);
    const signatures = pairs
      .filter((part) => part.startsWith("v1="))
      .map((part) => part.slice(3));
    return signatures.some((sig) => safeEqualHex(expected, sig));
  }

  const signature = headers.signature?.trim();
  const timestamp = headers.timestamp?.trim();
  if (!signature || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || !isFresh(ts, tolerance, nowSeconds)) return false;

  const expected = expectedDigest(secret, timestamp, body);
  return safeEqualHex(expected, signature);
}

export function signBachsWebhookForTest(
  rawBody: Buffer | string,
  secret: string,
  timestampSeconds: number,
): { signature: string; signatureV2: string; timestamp: string } {
  const body = toBuffer(rawBody);
  const timestamp = String(timestampSeconds);
  const signature = expectedDigest(secret, timestamp, body);
  return {
    signature,
    signatureV2: `t=${timestamp},v1=${signature}`,
    timestamp,
  };
}
