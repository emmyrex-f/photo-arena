/**
 * Pure helpers for the payment-security rule: amount + currency reported by the provider must
 * match the frozen Payment before it may become SUCCESS. No Nest / Prisma imports so the
 * verification scripts can exercise them directly.
 */

/** Bachs event types this integration subscribes to (docs.bachs.io/guides/webhooks/overview). */
export const BACHS_WEBHOOK_EVENTS = [
  "collection.succeeded",
  "collection.failed",
  "collection.underpaid",
  "checkout.completed",
  "checkout.expired",
  "refund.paid",
] as const;

/**
 * Bachs money is a decimal string at currency precision ("57000.00"). Convert to integer kobo
 * without floating point. Returns null when the string is not a plain 0–2 decimal number.
 */
export function decimalToKobo(value: string): number | null {
  const match = /^\s*(\d+)(?:\.(\d{1,2}))?\s*$/.exec(value);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(whole) || !Number.isFinite(fraction)) return null;
  return whole * 100 + fraction;
}

export type FrozenAmount = { amountKobo: number; currency: string };

/**
 * When the provider omits amount/currency (legacy or test-tool events) there is nothing to
 * compare, so the signed event alone decides. Anything present must match exactly.
 */
export function providerAmountMatches(
  payment: FrozenAmount,
  amount?: string,
  currency?: string,
): { ok: boolean; reason?: string } {
  if (amount == null && currency == null) return { ok: true };
  if (currency != null && currency.toUpperCase() !== payment.currency.toUpperCase()) {
    return { ok: false, reason: `currency ${currency} != ${payment.currency}` };
  }
  if (amount != null) {
    const kobo = decimalToKobo(amount);
    if (kobo == null) return { ok: false, reason: `unparseable amount "${amount}"` };
    if (kobo !== payment.amountKobo) {
      return { ok: false, reason: `amount ${kobo} kobo != expected ${payment.amountKobo} kobo` };
    }
  }
  return { ok: true };
}
