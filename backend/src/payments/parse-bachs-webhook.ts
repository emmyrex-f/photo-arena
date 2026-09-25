import type { PaymentWebhookEvent, WebhookParseInput } from "./payment-provider";
import { verifyBachsWebhookSignature } from "./bachs-webhook";

/**
 * Envelope + `data` fields we read. Shapes per docs.bachs.io/guides/webhooks/events/*:
 *  - collection.succeeded / collection.failed: data.{charge_id, checkout_id, reference, status, amount, currency, metadata}
 *  - checkout.completed: data.{checkout_id, reference, payment_status, amount, currency, charge: { id, status }, metadata}
 * Parse leniently: Bachs may add fields at any time.
 */
type BachsWebhookBody = {
  id?: string;
  type?: string;
  data?: {
    charge_id?: string | null;
    checkout_id?: string;
    reference?: string | null;
    status?: string;
    /** checkout.completed only: "paid" | "no_payment_required". */
    payment_status?: string;
    amount?: string | number | null;
    currency?: string | null;
    charge?: { id?: string; status?: string } | null;
    metadata?: { reference?: string; booking_reference?: string } | null;
    id?: string;
  };
};

/** Fires when funds are collected. */
const SUCCESS_TYPES = new Set(["collection.succeeded"]);
/**
 * checkout.completed fires "whether or not a payment was collected" — it counts as
 * success only when data.payment_status === "paid". A free / setup checkout reports
 * "no_payment_required" and must never confirm a booking.
 */
const CHECKOUT_COMPLETED_TYPE = "checkout.completed";
const FAILED_TYPES = new Set(["collection.failed"]);
/** Abandoned / incomplete / expired checkout events that release temporary holds and notify customer and admin. */
const ABANDONED_TYPES = new Set([
  "collection.abandoned",
  "collection.underpaid",
  "checkout.expired",
]);

function asDecimalString(value: string | number | null | undefined): string | undefined {
  if (value == null) return undefined;
  const text = typeof value === "number" ? String(value) : value.trim();
  return text ? text : undefined;
}

/** Shared Bachs webhook verify + map. Used by live provider and Mock (local Step 11 tests). */
export function parseBachsWebhookEvent(
  input: WebhookParseInput,
  webhookSecret: string,
): PaymentWebhookEvent {
  if (!webhookSecret) {
    throw new Error("Bachs webhook secret is not configured");
  }

  const ok = verifyBachsWebhookSignature(input.rawBody, webhookSecret, {
    signature: input.signature,
    signatureV2: input.signatureV2,
    timestamp: input.timestamp,
  });
  if (!ok) {
    throw new Error("Invalid Bachs webhook signature");
  }

  let body: BachsWebhookBody;
  try {
    const text = Buffer.isBuffer(input.rawBody)
      ? input.rawBody.toString("utf8")
      : String(input.rawBody);
    body = JSON.parse(text) as BachsWebhookBody;
  } catch {
    throw new Error("Invalid Bachs webhook JSON");
  }

  const type = body.type ?? "unknown";
  const data = body.data ?? {};
  const reference =
    data.reference ?? data.metadata?.reference ?? data.metadata?.booking_reference ?? "";

  const completedAndPaid =
    type === CHECKOUT_COMPLETED_TYPE && (data.payment_status ?? "").toLowerCase() === "paid";

  return {
    eventId: body.id ?? "",
    reference,
    success: SUCCESS_TYPES.has(type) || completedAndPaid,
    failed: FAILED_TYPES.has(type),
    abandoned: ABANDONED_TYPES.has(type),
    transactionId: data.charge_id ?? data.charge?.id ?? data.id ?? undefined,
    providerSessionId: data.checkout_id,
    amount: asDecimalString(data.amount),
    currency: data.currency?.trim().toUpperCase() || undefined,
    rawType: type,
  };
}
