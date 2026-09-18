/**
 * Step 11 — booking → payment → webhook chain against a running API.
 *
 * Prerequisites:
 *   - API on API_BASE (default http://localhost:3001/api)
 *   - Mock (`PAYMENTS_MOCK=true`) or Bachs sandbox; webhooks are signed locally
 *   - BACHS_WEBHOOK_SECRET matching WEBHOOK_SECRET (default whsec_local_photo_arena_dev)
 *
 * Covers:
 *   Test 1 — successful payment (webhook → CONFIRMED)
 *   Test 2 — failed payment (booking stays unpaid hold)
 *   Test 3 — abandoned payment (booking stays unpaid hold)
 *   Test 4 — duplicate webhook (duplicate: true, still one confirmation)
 */
import "./load-env";
import assert from "node:assert/strict";
import { signBachsWebhookForTest } from "../src/payments/bachs-webhook";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");
const WEBHOOK_SECRET =
  process.env.BACHS_WEBHOOK_SECRET?.trim() || "whsec_local_photo_arena_dev";

type Json = Record<string, unknown>;

async function api<T = Json>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = { raw: text } as T;
  }
  return { status: response.status, data };
}

function okStatus(status: number) {
  return status >= 200 && status < 300;
}

function lagosDateOffset(days: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(Date.now() + days * 86_400_000));
}

async function createHoldCheckout(label: string) {
  const packages = await api<
    Array<{ id: string; packages: Array<{ id: string; durationMinutes: number }> }>
  >("GET", "/bookings/packages");
  assert.ok(okStatus(packages.status), `${label}: packages ${packages.status}`);
  const first = packages.data[0];
  assert.ok(first?.packages?.[0], `${label}: need a seeded package`);
  const pkg = first.packages[0];

  let slot: string | undefined;
  for (let day = 1; day <= 14; day += 1) {
    const date = lagosDateOffset(day);
    const avail = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(date)}&durationMinutes=${pkg.durationMinutes}`,
    );
    if (okStatus(avail.status) && avail.data.slots?.length) {
      slot = avail.data.slots[0];
      break;
    }
  }
  assert.ok(slot, `${label}: no open slots in next 14 days`);

  const hold = await api<{
    bookingId: string;
    reference: string;
    amountKobo: number;
  }>("POST", "/bookings/hold", {
    packageId: pkg.id,
    startTime: slot,
    customerName: `Flow Test ${label}`,
    customerPhone: "+2348010000000",
    customerEmail: `flow-${label.toLowerCase().replace(/\s+/g, "-")}@example.com`,
  });
  assert.ok(okStatus(hold.status), `${label}: hold ${hold.status} ${JSON.stringify(hold.data)}`);

  const checkout = await api<{ provider: string; checkoutUrl: string; reference: string }>(
    "POST",
    `/bookings/${hold.data.bookingId}/checkout`,
    {
      reference: hold.data.reference,
      returnUrl: "http://localhost:5173/book/confirmation",
      cancelUrl: "http://localhost:5173/book?cancelled=1",
    },
  );
  assert.ok(okStatus(checkout.status), `${label}: checkout ${checkout.status}`);
  assert.ok(
    checkout.data.provider === "mock" || checkout.data.provider === "bachs",
    `${label}: unexpected provider ${checkout.data.provider}`,
  );
  assert.equal(checkout.data.reference, hold.data.reference);

  return {
    bookingId: hold.data.bookingId,
    reference: hold.data.reference,
    providerSessionId: `mock_${hold.data.reference}`,
  };
}

async function postWebhook(opts: {
  id: string;
  type: string;
  reference: string;
  checkoutId: string;
  status?: string;
}) {
  const payload = JSON.stringify({
    id: opts.id,
    type: opts.type,
    created_at: new Date().toISOString(),
    organization_id: "acct_local_test",
    data: {
      charge_id: opts.type === "collection.succeeded" ? `chr_${opts.id}` : null,
      checkout_id: opts.checkoutId,
      reference: opts.reference,
      status: opts.status ?? (opts.type === "collection.succeeded" ? "SUCCEEDED" : "FAILED"),
      amount: "57000.00",
      currency: "NGN",
      metadata: { reference: opts.reference },
    },
  });
  const now = Math.floor(Date.now() / 1000);
  const signed = signBachsWebhookForTest(payload, WEBHOOK_SECRET, now);
  const response = await fetch(`${API_BASE}/payments/webhook/bachs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Bachs-Signature-V2": signed.signatureV2,
      "X-Bachs-Signature": signed.signature,
      "X-Bachs-Timestamp": signed.timestamp,
    },
    body: payload,
  });
  const data = (await response.json()) as { received?: boolean; duplicate?: boolean };
  return { status: response.status, data };
}

async function bookingStatus(bookingId: string) {
  return api<{
    status: string;
    payment: { status: string; reference: string } | null;
  }>("GET", `/bookings/${bookingId}/status`);
}

async function main() {
  console.log(`Payment flow verify → ${API_BASE}`);

  // Test 1 — success
  const success = await createHoldCheckout("Success");
  const successEventId = `evt_success_${success.reference}`;
  const ok1 = await postWebhook({
    id: successEventId,
    type: "collection.succeeded",
    reference: success.reference,
    checkoutId: success.providerSessionId,
  });
  assert.ok(okStatus(ok1.status), `T1 webhook ${ok1.status}`);
  assert.equal(ok1.data.received, true);
  assert.notEqual(ok1.data.duplicate, true);
  const afterSuccess = await bookingStatus(success.bookingId);
  assert.equal(afterSuccess.data.status, "CONFIRMED", "T1 booking CONFIRMED");
  assert.equal(afterSuccess.data.payment?.status, "SUCCESS", "T1 payment SUCCESS");
  console.log("Test 1 — successful payment ✓");

  // Test 4 — duplicate of Test 1
  const dup = await postWebhook({
    id: successEventId,
    type: "collection.succeeded",
    reference: success.reference,
    checkoutId: success.providerSessionId,
  });
  assert.ok(okStatus(dup.status), `T4 webhook ${dup.status}`);
  assert.equal(dup.data.received, true);
  assert.equal(dup.data.duplicate, true, "T4 duplicate webhook");
  const stillOne = await bookingStatus(success.bookingId);
  assert.equal(stillOne.data.status, "CONFIRMED");
  assert.equal(stillOne.data.payment?.status, "SUCCESS");
  console.log("Test 4 — duplicate webhook ✓");

  // Test 2 — failed
  const failed = await createHoldCheckout("Failed");
  const failHook = await postWebhook({
    id: `evt_failed_${failed.reference}`,
    type: "collection.failed",
    reference: failed.reference,
    checkoutId: failed.providerSessionId,
    status: "FAILED",
  });
  assert.ok(okStatus(failHook.status), `T2 webhook ${failHook.status}`);
  assert.equal(failHook.data.received, true);
  const afterFail = await bookingStatus(failed.bookingId);
  assert.equal(afterFail.data.status, "TEMPORARY_HOLD", "T2 booking stays hold");
  assert.equal(afterFail.data.payment?.status, "FAILED", "T2 payment FAILED");
  console.log("Test 2 — failed payment ✓");

  // Test 3 — abandoned
  const abandoned = await createHoldCheckout("Abandoned");
  const abandonHook = await postWebhook({
    id: `evt_abandoned_${abandoned.reference}`,
    type: "collection.abandoned",
    reference: abandoned.reference,
    checkoutId: abandoned.providerSessionId,
    status: "ABANDONED",
  });
  assert.ok(okStatus(abandonHook.status), `T3 webhook ${abandonHook.status}`);
  assert.equal(abandonHook.data.received, true);
  const afterAbandon = await bookingStatus(abandoned.bookingId);
  assert.equal(afterAbandon.data.status, "TEMPORARY_HOLD", "T3 booking stays hold");
  assert.ok(
    afterAbandon.data.payment?.status === "PROCESSING" ||
      afterAbandon.data.payment?.status === "PENDING",
    `T3 payment stays unpaid (${afterAbandon.data.payment?.status})`,
  );
  console.log("Test 3 — abandoned payment ✓");

  console.log("All payment-flow tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
