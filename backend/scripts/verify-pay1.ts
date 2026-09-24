/**
 * PAY-1 focused checks: providerAmountMatches + live webhook amount/currency gate.
 * Requires API with PAYMENTS_MOCK=true and BACHS_WEBHOOK_SECRET set.
 */
import "./load-env";
import assert from "node:assert/strict";
import { BookingStatus, PaymentStatus, PrismaClient } from "@prisma/client";
import { providerAmountMatches } from "../src/payments/payment-amount";
import { signBachsWebhookForTest } from "../src/payments/bachs-webhook";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");
const WEBHOOK_SECRET =
  process.env.BACHS_WEBHOOK_SECRET?.trim() || "whsec_local_photo_arena_dev";
const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? "owner@photoarenang.com").trim().toLowerCase();
const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme";

const prisma = new PrismaClient();

type Json = Record<string, unknown>;

async function api<T = Json>(
  method: string,
  path: string,
  opts?: { body?: unknown; token?: string; ip?: string },
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {};
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts?.ip) headers["X-Forwarded-For"] = opts.ip;
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
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

function lagosDateOffset(days: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + days * 86_400_000));
}

function kobToDecimal(kobo: number): string {
  return (kobo / 100).toFixed(2);
}

async function postWebhook(opts: {
  id: string;
  type: string;
  reference: string;
  checkoutId: string | null | undefined;
  amountKobo: number;
  currency?: string;
  amountOverride?: string;
}) {
  const success = opts.type === "collection.succeeded";
  const payload = JSON.stringify({
    id: opts.id,
    type: opts.type,
    created_at: new Date().toISOString(),
    organization_id: "acct_pay1",
    data: {
      charge_id: success ? `ch_${opts.id}` : null,
      checkout_id: opts.checkoutId ?? undefined,
      reference: opts.reference,
      status: success ? "succeeded" : "failed",
      amount: opts.amountOverride ?? kobToDecimal(opts.amountKobo),
      currency: opts.currency ?? "NGN",
      metadata: { reference: opts.reference },
    },
  });
  const signed = signBachsWebhookForTest(payload, WEBHOOK_SECRET, Math.floor(Date.now() / 1000));
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
  const text = await response.text();
  let data: { received?: boolean; duplicate?: boolean; ignored?: string } = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: response.status, data };
}

async function main() {
  // Unit: helper behavior
  const frozen = { amountKobo: 5_700_000, currency: "NGN" };
  assert.equal(providerAmountMatches(frozen, "57000.00", "NGN").ok, true);
  assert.equal(providerAmountMatches(frozen, "56999.99", "NGN").ok, false);
  assert.equal(providerAmountMatches(frozen, "57000.00", "USD").ok, false);
  console.log("providerAmountMatches unit ✓");

  const packages = await api<
    Array<{ id: string; packages: Array<{ id: string; durationMinutes: number; priceKobo: number }> }>
  >("GET", "/bookings/packages", { ip: "10.255.9.1" });
  assert.ok(packages.status < 300);
  const pkg = packages.data[0]?.packages?.[0];
  assert.ok(pkg, "need package");

  let slot = "";
  for (let day = 2; day <= 14 && !slot; day += 1) {
    const date = lagosDateOffset(day);
    const avail = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(date)}&durationMinutes=${pkg.durationMinutes}`,
      { ip: "10.255.9.1" },
    );
    slot = avail.data.slots?.[0] ?? "";
  }
  assert.ok(slot, "need open slot");

  const stamp = Date.now();
  const hold = await api<{
    bookingId: string;
    reference: string;
    amountKobo: number;
    pricing?: { payableKobo: number };
  }>("POST", "/bookings/hold", {
    ip: "10.255.9.2",
    body: {
      packageId: pkg.id,
      startTime: slot,
      customerName: `PAY1 ${stamp}`,
      customerPhone: `0803${String(stamp).slice(-7)}`,
      customerEmail: `pay1-${stamp}@example.com`,
    },
  });
  assert.ok(hold.status < 300, `hold ${hold.status} ${JSON.stringify(hold.data)}`);
  const bookingId = hold.data.bookingId;
  const reference = hold.data.reference;
  const amountKobo = hold.data.amountKobo ?? hold.data.pricing?.payableKobo;
  assert.ok(amountKobo && amountKobo > 0);

  const checkout = await api<{ checkoutUrl: string; reference: string }>(
    "POST",
    `/bookings/${bookingId}/checkout`,
    {
      ip: "10.255.9.2",
      body: {
        reference,
        returnUrl: "http://localhost:5173/book/confirmation",
        cancelUrl: "http://localhost:5173/book",
      },
    },
  );
  assert.ok(checkout.status < 300, `checkout ${checkout.status}`);
  const payment = await prisma.payment.findFirst({ where: { reference } });
  assert.ok(payment);
  assert.equal(payment.amountKobo, amountKobo);
  assert.equal(payment.currency, "NGN");

  // Wrong amount → rejected (acknowledged, not confirmed)
  const wrongAmount = await postWebhook({
    id: `evt_pay1_wrong_amt_${stamp}`,
    type: "collection.succeeded",
    reference,
    checkoutId: payment.providerSessionId,
    amountKobo,
    amountOverride: "1.00",
  });
  assert.ok(wrongAmount.status < 300, `wrong amount status ${wrongAmount.status}`);
  assert.equal(wrongAmount.data.ignored, "amount_mismatch");
  let row = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: true },
  });
  assert.notEqual(row?.status, BookingStatus.CONFIRMED);
  assert.notEqual(row?.payments[0]?.status, PaymentStatus.SUCCESS);
  assert.match(row?.notes ?? "", /AMOUNT_MISMATCH/);
  console.log("wrong amount → rejected ✓");

  // Wrong currency → rejected
  const wrongCurrency = await postWebhook({
    id: `evt_pay1_wrong_cur_${stamp}`,
    type: "collection.succeeded",
    reference,
    checkoutId: payment.providerSessionId,
    amountKobo,
    currency: "USD",
  });
  assert.equal(wrongCurrency.data.ignored, "amount_mismatch");
  row = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: true },
  });
  assert.notEqual(row?.status, BookingStatus.CONFIRMED);
  assert.notEqual(row?.payments[0]?.status, PaymentStatus.SUCCESS);
  console.log("wrong currency → rejected ✓");

  // Correct amount + currency → succeeds
  const right = await postWebhook({
    id: `evt_pay1_ok_${stamp}`,
    type: "collection.succeeded",
    reference,
    checkoutId: payment.providerSessionId,
    amountKobo,
  });
  assert.ok(right.status < 300);
  assert.notEqual(right.data.ignored, "amount_mismatch");
  row = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: true },
  });
  assert.equal(row?.status, BookingStatus.CONFIRMED);
  assert.equal(row?.payments[0]?.status, PaymentStatus.SUCCESS);
  console.log("correct amount + currency → succeeds ✓");

  // Duplicate confirmation → idempotent
  const dup = await postWebhook({
    id: `evt_pay1_ok_${stamp}`,
    type: "collection.succeeded",
    reference,
    checkoutId: payment.providerSessionId,
    amountKobo,
  });
  assert.equal(dup.data.duplicate, true);
  const payCount = await prisma.payment.count({
    where: { bookingId, status: PaymentStatus.SUCCESS },
  });
  assert.equal(payCount, 1);
  console.log("duplicate webhook → idempotent ✓");

  // Studio Mark Paid still works (separate PENDING walk-in path)
  const login = await api<{ token: string }>("POST", "/auth/login", {
    body: { email: ownerEmail, password: ownerPassword },
    ip: "10.255.9.3",
  });
  assert.ok(login.status < 300 && login.data.token, `login ${login.status}`);

  let studioSlot = "";
  for (let day = 3; day <= 16 && !studioSlot; day += 1) {
    const date = lagosDateOffset(day);
    const avail = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(date)}&durationMinutes=${pkg.durationMinutes}`,
      { token: login.data.token },
    );
    studioSlot = avail.data.slots?.[0] ?? "";
  }
  assert.ok(studioSlot, "need studio slot");

  const pending = await api<{ id: string }>("POST", "/admin/bookings", {
    token: login.data.token,
    body: {
      packageId: pkg.id,
      startTime: studioSlot,
      customerName: `Studio PAY1 ${stamp}`,
      customerPhone: `0804${String(stamp).slice(-7)}`,
      customerEmail: `studio-pay1-${stamp}@example.com`,
      source: "WALK_IN",
    },
  });
  assert.ok(pending.status < 300, `admin booking ${pending.status} ${JSON.stringify(pending.data)}`);
  const markPaid = await api("POST", `/admin/bookings/${pending.data.id}/payment`, {
    token: login.data.token,
    body: { note: "PAY-1 studio cash" },
  });
  assert.ok(markPaid.status < 300, `mark-paid ${markPaid.status} ${JSON.stringify(markPaid.data)}`);
  const studioRow = await prisma.booking.findUnique({
    where: { id: pending.data.id },
    include: { payments: true },
  });
  assert.equal(studioRow?.status, BookingStatus.CONFIRMED);
  assert.ok(studioRow?.payments.some((p) => p.status === PaymentStatus.SUCCESS && p.method === "STUDIO"));
  console.log("admin/studio Mark Paid → still works ✓");

  console.log("\nPAY-1 verification passed");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
