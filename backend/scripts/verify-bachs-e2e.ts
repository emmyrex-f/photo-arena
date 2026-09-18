/**
 * Bachs payment E2E — booking → hold → checkout → webhook/verify → CONFIRMED, plus the
 * negative paths. Runs against a live API and the local database.
 *
 * Modes (detected from the checkout response `provider`):
 *   mock     PAYMENTS_MOCK=true on the API. Every webhook is synthesised here and signed with
 *            BACHS_WEBHOOK_SECRET (must equal the API's value).
 *   bachs    BACHS_API_KEY=sk_sandbox_… on the API. TEST 1 creates a REAL sandbox checkout and
 *            waits for you to pay on the hosted page (the real webhook or the server-side
 *            /payments/verify call confirms it). All other tests still synthesise signed events so
 *            the handler's idempotency / signature / amount checks are exercised the same way.
 *            Set E2E_SIMULATE_WEBHOOK=1 to skip the manual payment and confirm TEST 1 synthetically.
 *
 * Env:
 *   API_BASE               default http://localhost:3001/api
 *   BACHS_WEBHOOK_SECRET   default whsec_local_photo_arena_dev (must match the API)
 *   DATABASE_URL           read by Prisma (backend/.env)
 *   E2E_PAY_TIMEOUT_MS     sandbox manual-pay wait, default 300000 (5 min)
 *   E2E_SIMULATE_WEBHOOK   "1" → never wait for a real payment
 *   E2E_SITE_ORIGIN        return/cancel origin, default http://localhost:5173. Loopback origins
 *                          are allowlisted locally but omitted from the Bachs payload (Bachs
 *                          rejects localhost success_url). A public https origin is forwarded.
 *
 * The API should run with TRUST_PROXY=true locally so each scenario can present its own
 * X-Forwarded-For and stay under HOLD_IP_LIMIT (verify-security.ts uses the same trick).
 *
 * Scenarios: T1 happy · T2 duplicate webhook · T3 invalid signature · T4 failed · T5 abandoned/expired
 * checkout · T6 expired hold + free slot · T7 expired hold + slot taken · T8 wrong reference ·
 * T9 external return URL · T10 price tampering (body, webhook amount, unpaid checkout.completed).
 */
import "./load-env";
import assert from "node:assert/strict";
import { BookingStatus, PaymentStatus, PrismaClient } from "@prisma/client";
import { signBachsWebhookForTest } from "../src/payments/bachs-webhook";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");
const WEBHOOK_SECRET = process.env.BACHS_WEBHOOK_SECRET?.trim() || "whsec_local_photo_arena_dev";
const PAY_TIMEOUT_MS = Number(process.env.E2E_PAY_TIMEOUT_MS ?? 300_000);
const SIMULATE_WEBHOOK = process.env.E2E_SIMULATE_WEBHOOK === "1";
const SITE_ORIGIN = (process.env.E2E_SITE_ORIGIN ?? "http://localhost:5173").replace(/\/$/, "");
const RETURN_URL = `${SITE_ORIGIN}/book/confirmation`;
const CANCEL_URL = `${SITE_ORIGIN}/book?cancelled=1`;

type Json = Record<string, unknown>;
type StatusResponse = {
  status: BookingStatus;
  amountKobo: number | null;
  payment: { status: string; provider: string | null } | null;
};
type HoldResponse = {
  bookingId: string;
  reference: string;
  startTime: string;
  pricing: { baseKobo: number; discountKobo: number; payableKobo: number };
};
type CheckoutResponse = { provider: "mock" | "bachs"; checkoutUrl: string; reference: string };

const prisma = new PrismaClient();
const stamp = String(Date.now()).slice(-7);
let ipCounter = 0;

function nextIp() {
  ipCounter += 1;
  return `10.77.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

function phone(n: number) {
  return `0809${stamp.slice(0, 3)}${String(n).padStart(4, "0")}`;
}

async function api<T = Json>(
  method: string,
  path: string,
  opts?: { body?: unknown; ip?: string; headers?: Record<string, string> },
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { ...(opts?.headers ?? {}) };
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

const ok = (s: number) => s >= 200 && s < 300;

function lagosDateOffset(days: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + days * 86_400_000));
}

async function firstPackage(ip: string) {
  const packages = await api<
    Array<{ id: string; packages: Array<{ id: string; durationMinutes: number; priceKobo: number }> }>
  >("GET", "/bookings/packages", { ip });
  assert.ok(ok(packages.status), `packages ${packages.status}`);
  const pkg = packages.data[0]?.packages?.[0];
  assert.ok(pkg, "need a seeded package");
  return pkg;
}

async function openSlots(count: number, ip: string, exclude = new Set<string>()) {
  const pkg = await firstPackage(ip);
  const slots: string[] = [];
  for (let day = 1; day <= 30 && slots.length < count; day += 1) {
    const avail = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${lagosDateOffset(day)}&durationMinutes=${pkg.durationMinutes}`,
      { ip },
    );
    for (const s of avail.data.slots ?? []) {
      if (!exclude.has(s) && !slots.includes(s)) slots.push(s);
      if (slots.length >= count) break;
    }
  }
  assert.ok(slots.length >= count, `need ${count} open slots, found ${slots.length}`);
  return { pkg, slots };
}

const usedSlots = new Set<string>();

async function hold(label: string, n: number, ip: string, slot?: string) {
  const { pkg, slots } = await openSlots(1, ip, usedSlots);
  const startTime = slot ?? slots[0]!;
  usedSlots.add(startTime);
  const res = await api<HoldResponse>("POST", "/bookings/hold", {
    ip,
    body: {
      packageId: pkg.id,
      startTime,
      customerName: `E2E ${label}`,
      customerPhone: phone(n),
      customerEmail: `e2e-${label.toLowerCase().replace(/\W+/g, "-")}-${stamp}@example.com`,
    },
  });
  assert.ok(ok(res.status), `${label}: hold ${res.status} ${JSON.stringify(res.data)}`);
  return { ...res.data, pkg, ip };
}

async function checkout(h: { bookingId: string; reference: string; ip: string }, label: string) {
  const res = await api<CheckoutResponse>("POST", `/bookings/${h.bookingId}/checkout`, {
    ip: h.ip,
    body: { reference: h.reference, returnUrl: RETURN_URL, cancelUrl: CANCEL_URL },
  });
  if (!ok(res.status)) {
    // 502 = the API reached the provider and was refused. Outside production the body carries the
    // provider's own reason; the API log line "Checkout ... for <ref>" has the same text.
    const hint =
      res.status === 502
        ? `\n  ↳ Provider refused the session. See API log "Checkout ... for <ref>" (no secrets).`
        : "";
    assert.fail(`${label}: checkout ${res.status} ${JSON.stringify(res.data)}${hint}`);
  }
  assert.equal(res.data.reference, h.reference, `${label}: checkout echoes booking reference`);
  assert.ok(res.data.checkoutUrl, `${label}: checkoutUrl present`);
  const payment = await prisma.payment.findUnique({ where: { reference: h.reference } });
  assert.ok(payment, `${label}: Payment row created`);
  return { ...res.data, payment };
}

function kobToDecimal(kobo: number) {
  return `${Math.floor(kobo / 100)}.${String(kobo % 100).padStart(2, "0")}`;
}

type WebhookOpts = {
  id: string;
  type: string;
  reference: string;
  checkoutId: string | null | undefined;
  amountKobo: number;
  currency?: string;
  amountOverride?: string;
  extraData?: Record<string, unknown>;
  badSignature?: boolean;
  staleSeconds?: number;
};

async function postWebhook(o: WebhookOpts) {
  const success = o.type === "collection.succeeded";
  const payload = JSON.stringify({
    id: o.id,
    type: o.type,
    created_at: new Date().toISOString(),
    organization_id: "acct_e2e_local",
    data: {
      charge_id: success ? `ch_${o.id}` : null,
      checkout_id: o.checkoutId ?? undefined,
      reference: o.reference,
      status: success ? "succeeded" : o.type === "collection.failed" ? "failed" : "expired",
      amount: o.amountOverride ?? kobToDecimal(o.amountKobo),
      currency: o.currency ?? "NGN",
      metadata: { reference: o.reference },
      ...(o.extraData ?? {}),
    },
  });
  const now = Math.floor(Date.now() / 1000) - (o.staleSeconds ?? 0);
  const signed = signBachsWebhookForTest(payload, o.badSignature ? "not-the-secret" : WEBHOOK_SECRET, now);
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
  let data: { received?: boolean; duplicate?: boolean; ignored?: string; message?: string } = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  return { status: response.status, data };
}

async function status(bookingId: string, ip: string, reference: string) {
  const res = await api<StatusResponse>(
    "GET",
    `/bookings/${bookingId}/status?reference=${encodeURIComponent(reference)}`,
    { ip },
  );
  assert.ok(ok(res.status), `status ${res.status}`);
  return res.data;
}

async function dbBooking(id: string) {
  const b = await prisma.booking.findUnique({ where: { id }, include: { payments: true } });
  assert.ok(b, "booking in DB");
  return b;
}

function step(title: string) {
  console.log(`\n${title}`);
}

async function main() {
  console.log(`Bachs E2E → ${API_BASE}`);

  // ───────────────────────── T1 — happy path ─────────────────────────
  step("TEST 1 — happy path");
  const t1 = await hold("Happy", 1, nextIp());
  const co1 = await checkout(t1, "T1");
  const mode: "mock" | "bachs" = co1.provider;
  console.log(`  provider: ${mode}${mode === "bachs" ? " (REAL sandbox checkout created)" : ""}`);
  assert.equal(co1.payment.amountKobo, t1.pricing.payableKobo, "T1: Payment frozen at server payable");
  assert.equal(co1.payment.currency, "NGN");
  assert.equal(co1.payment.status, PaymentStatus.PROCESSING);

  const t1EventId = `evt_e2e_success_${t1.reference}`;
  if (mode === "bachs" && !SIMULATE_WEBHOOK) {
    assert.match(co1.checkoutUrl, /^https:\/\//, "T1: hosted checkout must be https");
    assert.ok(co1.payment.providerSessionId?.startsWith("chk_"), "T1: checkout_id stored on Payment");
    console.log("\n  ➜ Open this sandbox checkout in a browser and complete the payment:");
    console.log(`    ${co1.checkoutUrl}`);
    console.log(`  Waiting up to ${Math.round(PAY_TIMEOUT_MS / 1000)}s for webhook / server-side verification…`);
    const deadline = Date.now() + PAY_TIMEOUT_MS;
    let confirmed = false;
    while (Date.now() < deadline) {
      const v = await api<StatusResponse>("GET", `/payments/verify?reference=${encodeURIComponent(t1.reference)}`, {
        ip: t1.ip,
      });
      if (ok(v.status) && v.data.status === BookingStatus.CONFIRMED) {
        confirmed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
    assert.ok(confirmed, "T1: booking did not reach CONFIRMED within the wait window");
  } else {
    const hook = await postWebhook({
      id: t1EventId,
      type: "collection.succeeded",
      reference: t1.reference,
      checkoutId: co1.payment.providerSessionId,
      amountKobo: co1.payment.amountKobo,
    });
    assert.ok(ok(hook.status), `T1: webhook ${hook.status} ${JSON.stringify(hook.data)}`);
    assert.equal(hook.data.received, true);
    assert.notEqual(hook.data.duplicate, true);
  }
  const s1 = await status(t1.bookingId, t1.ip, t1.reference);
  assert.equal(s1.status, BookingStatus.CONFIRMED, "T1: booking CONFIRMED");
  assert.equal(s1.payment?.status, PaymentStatus.SUCCESS, "T1: payment SUCCESS");
  const t1Db = await dbBooking(t1.bookingId);
  assert.ok(t1Db.payments.find((p) => p.status === PaymentStatus.SUCCESS)?.paidAt, "T1: paidAt set");
  assert.equal(t1Db.holdExpiresAt, null, "T1: hold cleared on confirm");
  console.log("  ✓ hold → checkout → paid → SUCCESS → CONFIRMED");

  // ───────────────────────── T2 — duplicate webhook ─────────────────────────
  step("TEST 2 — duplicate webhook");
  const dupEventId = mode === "bachs" && !SIMULATE_WEBHOOK ? `evt_e2e_dup_${t1.reference}` : t1EventId;
  if (dupEventId !== t1EventId) {
    // Real payment confirmed T1; a fresh synthetic success for the same payment must be a no-op.
    const first = await postWebhook({
      id: dupEventId,
      type: "collection.succeeded",
      reference: t1.reference,
      checkoutId: co1.payment.providerSessionId,
      amountKobo: co1.payment.amountKobo,
    });
    assert.ok(ok(first.status));
  }
  const dup = await postWebhook({
    id: dupEventId,
    type: "collection.succeeded",
    reference: t1.reference,
    checkoutId: co1.payment.providerSessionId,
    amountKobo: co1.payment.amountKobo,
  });
  assert.ok(ok(dup.status), `T2: duplicate webhook ${dup.status}`);
  assert.equal(dup.data.duplicate, true, "T2: duplicate flagged");
  const t2Db = await dbBooking(t1.bookingId);
  assert.equal(t2Db.status, BookingStatus.CONFIRMED);
  assert.equal(t2Db.payments.length, 1, "T2: exactly one Payment row");
  assert.equal(t2Db.payments.filter((p) => p.status === PaymentStatus.SUCCESS).length, 1);
  const processed = await prisma.processedWebhookEvent.count({ where: { id: dupEventId } });
  assert.equal(processed, 1, "T2: one ProcessedWebhookEvent row");
  const sameBookingCount = await prisma.booking.count({
    where: { customer: { phone: phone(1) }, status: BookingStatus.CONFIRMED },
  });
  assert.equal(sameBookingCount, 1, "T2: no duplicate booking");
  console.log("  ✓ duplicate → { duplicate: true }, single payment effect, still CONFIRMED");

  // ───────────────────────── T3 — invalid signature ─────────────────────────
  step("TEST 3 — invalid webhook signature");
  const t3 = await hold("Bad Sig", 3, nextIp());
  const co3 = await checkout(t3, "T3");
  const bad = await postWebhook({
    id: `evt_e2e_badsig_${t3.reference}`,
    type: "collection.succeeded",
    reference: t3.reference,
    checkoutId: co3.payment.providerSessionId,
    amountKobo: co3.payment.amountKobo,
    badSignature: true,
  });
  assert.equal(bad.status, 401, `T3: bad signature → 401 (got ${bad.status})`);
  const stale = await postWebhook({
    id: `evt_e2e_stale_${t3.reference}`,
    type: "collection.succeeded",
    reference: t3.reference,
    checkoutId: co3.payment.providerSessionId,
    amountKobo: co3.payment.amountKobo,
    staleSeconds: 900,
  });
  assert.equal(stale.status, 401, `T3: stale timestamp → 401 (got ${stale.status})`);
  const noSig = await fetch(`${API_BASE}/payments/webhook/bachs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "evt_e2e_nosig", type: "collection.succeeded", data: { reference: t3.reference } }),
  });
  assert.equal(noSig.status, 401, `T3: missing signature → 401 (got ${noSig.status})`);
  const s3 = await status(t3.bookingId, t3.ip, t3.reference);
  assert.equal(s3.status, BookingStatus.TEMPORARY_HOLD, "T3: booking unchanged");
  assert.notEqual(s3.payment?.status, PaymentStatus.SUCCESS, "T3: payment unchanged");
  assert.equal(await prisma.processedWebhookEvent.count({ where: { id: { startsWith: `evt_e2e_badsig_` } } }), 0);
  console.log("  ✓ bad / stale / missing signature → 401, nothing changed");

  // ───────────────────────── T4 — failed payment ─────────────────────────
  step("TEST 4 — failed payment");
  const t4 = await hold("Failed", 4, nextIp());
  const co4 = await checkout(t4, "T4");
  const fail = await postWebhook({
    id: `evt_e2e_failed_${t4.reference}`,
    type: "collection.failed",
    reference: t4.reference,
    checkoutId: co4.payment.providerSessionId,
    amountKobo: co4.payment.amountKobo,
  });
  assert.ok(ok(fail.status), `T4: webhook ${fail.status}`);
  const s4 = await status(t4.bookingId, t4.ip, t4.reference);
  assert.equal(s4.payment?.status, PaymentStatus.FAILED, "T4: payment FAILED");
  assert.notEqual(s4.status, BookingStatus.CONFIRMED, "T4: booking not CONFIRMED");
  assert.equal(s4.status, BookingStatus.TEMPORARY_HOLD, "T4: hold stays until expiry");
  console.log("  ✓ collection.failed → payment FAILED, booking not confirmed");

  // ───────────────────────── T5 — abandoned checkout ─────────────────────────
  step("TEST 5 — abandoned checkout");
  const t5 = await hold("Abandoned", 5, nextIp());
  const co5 = await checkout(t5, "T5");
  const expired = await postWebhook({
    id: `evt_e2e_expired_${t5.reference}`,
    type: "checkout.expired",
    reference: t5.reference,
    checkoutId: co5.payment.providerSessionId,
    amountKobo: co5.payment.amountKobo,
  });
  assert.ok(ok(expired.status), `T5: checkout.expired acknowledged (${expired.status})`);
  const verify5 = await api<StatusResponse>("GET", `/payments/verify?reference=${encodeURIComponent(t5.reference)}`, {
    ip: t5.ip,
  });
  assert.ok(ok(verify5.status), `T5: verify ${verify5.status}`);
  assert.notEqual(verify5.data.status, BookingStatus.CONFIRMED, "T5: verify does not confirm an unpaid session");
  const s5 = await status(t5.bookingId, t5.ip, t5.reference);
  assert.equal(s5.status, BookingStatus.TEMPORARY_HOLD, "T5: still a hold");
  assert.ok(
    s5.payment?.status === PaymentStatus.PROCESSING || s5.payment?.status === PaymentStatus.PENDING,
    `T5: payment unpaid (${s5.payment?.status})`,
  );
  console.log("  ✓ abandoned → hold remains unpaid until expiry, no false confirmation");

  // ───────────────────────── T6 — expired hold + slot free ─────────────────────────
  step("TEST 6 — expired hold, slot still free, late payment");
  const t6 = await hold("Late Free", 6, nextIp());
  const co6 = await checkout(t6, "T6");
  await prisma.booking.update({
    where: { id: t6.bookingId },
    data: { holdExpiresAt: new Date(Date.now() - 60_000), status: BookingStatus.CANCELLED }, // as the cron would
  });
  const late6 = await postWebhook({
    id: `evt_e2e_late_free_${t6.reference}`,
    type: "collection.succeeded",
    reference: t6.reference,
    checkoutId: co6.payment.providerSessionId,
    amountKobo: co6.payment.amountKobo,
  });
  assert.ok(ok(late6.status));
  const s6 = await status(t6.bookingId, t6.ip, t6.reference);
  assert.equal(s6.payment?.status, PaymentStatus.SUCCESS);
  assert.equal(s6.status, BookingStatus.CONFIRMED, "T6: paid + slot free → CONFIRMED");
  console.log("  ✓ expired hold + free slot + payment → CONFIRMED");

  // ───────────────────────── T7 — expired hold + slot taken ─────────────────────────
  step("TEST 7 — expired hold, slot taken by someone else, late payment");
  const t7 = await hold("Late Taken", 7, nextIp());
  const co7 = await checkout(t7, "T7");
  await prisma.booking.update({
    where: { id: t7.bookingId },
    data: { holdExpiresAt: new Date(Date.now() - 60_000), status: BookingStatus.CANCELLED },
  });
  const taker = await hold("Slot Taker", 8, nextIp(), t7.startTime);
  assert.equal(taker.startTime, t7.startTime, "T7: taker got the same slot");
  const late7 = await postWebhook({
    id: `evt_e2e_late_taken_${t7.reference}`,
    type: "collection.succeeded",
    reference: t7.reference,
    checkoutId: co7.payment.providerSessionId,
    amountKobo: co7.payment.amountKobo,
  });
  assert.ok(ok(late7.status));
  const s7 = await status(t7.bookingId, t7.ip, t7.reference);
  assert.equal(s7.payment?.status, PaymentStatus.SUCCESS, "T7: payment SUCCESS (money arrived)");
  assert.notEqual(s7.status, BookingStatus.CONFIRMED, "T7: original booking not CONFIRMED");
  const t7Db = await dbBooking(t7.bookingId);
  assert.match(t7Db.notes ?? "", /PAID_UNPLACED/, "T7: flagged PAID_UNPLACED for the desk");
  const takerStatus = await status(taker.bookingId, taker.ip, taker.reference);
  assert.equal(takerStatus.status, BookingStatus.TEMPORARY_HOLD, "T7: taker keeps the slot");
  const overlapping = await prisma.booking.count({
    where: {
      startTime: new Date(t7.startTime),
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.TEMPORARY_HOLD, BookingStatus.PENDING] },
    },
  });
  assert.equal(overlapping, 1, "T7: exactly one blocker on the slot — no double booking");
  console.log("  ✓ payment SUCCESS, original ≠ CONFIRMED, no double booking");

  // ───────────────────────── T8 — invalid reference ─────────────────────────
  step("TEST 8 — checkout with wrong booking reference");
  const t8 = await hold("Wrong Ref", 9, nextIp());
  const wrongRef = await api("POST", `/bookings/${t8.bookingId}/checkout`, {
    ip: t8.ip,
    body: { reference: "PA-NOT-THIS-ONE", returnUrl: RETURN_URL, cancelUrl: CANCEL_URL },
  });
  assert.equal(wrongRef.status, 400, `T8: wrong reference → 400 (got ${wrongRef.status})`);
  const missingRef = await api("POST", `/bookings/${t8.bookingId}/checkout`, {
    ip: t8.ip,
    body: { returnUrl: RETURN_URL, cancelUrl: CANCEL_URL },
  });
  assert.equal(missingRef.status, 400, "T8: missing reference → 400");
  assert.equal(await prisma.payment.count({ where: { bookingId: t8.bookingId } }), 0, "T8: no Payment created");
  console.log("  ✓ wrong / missing reference → 400, no payment session");

  // ───────────────────────── T9 — invalid return URL ─────────────────────────
  step("TEST 9 — external / disallowed return URL");
  for (const [label, returnUrl, cancelUrl] of [
    ["external origin", "https://evil.example/book/confirmation", CANCEL_URL],
    ["disallowed path", `${SITE_ORIGIN}/admin`, CANCEL_URL],
    ["external cancel", RETURN_URL, "https://evil.example/book"],
    ["javascript scheme", "javascript:alert(1)", CANCEL_URL],
    ["credentials in url", RETURN_URL.replace("://", "://user:pw@"), CANCEL_URL],
  ] as const) {
    const res = await api("POST", `/bookings/${t8.bookingId}/checkout`, {
      ip: t8.ip,
      body: { reference: t8.reference, returnUrl, cancelUrl },
    });
    assert.equal(res.status, 400, `T9: ${label} → 400 (got ${res.status})`);
  }
  assert.equal(await prisma.payment.count({ where: { bookingId: t8.bookingId } }), 0, "T9: no Payment created");
  console.log("  ✓ external / disallowed URLs → 400");

  // ───────────────────────── T10 — price tampering ─────────────────────────
  step("TEST 10 — frontend price tampering");
  const t10Ip = nextIp();
  const { pkg: pkg10, slots: slots10 } = await openSlots(1, t10Ip, usedSlots);
  usedSlots.add(slots10[0]!);
  const tamperedHold = await api("POST", "/bookings/hold", {
    ip: t10Ip,
    body: {
      packageId: pkg10.id,
      startTime: slots10[0],
      customerName: "E2E Tamper",
      customerPhone: phone(10),
      customerEmail: `e2e-tamper-${stamp}@example.com`,
      amountKobo: 100,
      pricing: { payableKobo: 100 },
    },
  });
  assert.equal(tamperedHold.status, 400, `T10a: extra price fields on hold → 400 (got ${tamperedHold.status})`);

  const t10 = await hold("Tamper", 10, t10Ip, slots10[0]);
  assert.ok(t10.pricing.payableKobo < t10.pricing.baseKobo, "T10: server applied online discount");
  const tamperedCheckout = await api("POST", `/bookings/${t10.bookingId}/checkout`, {
    ip: t10.ip,
    body: { reference: t10.reference, returnUrl: RETURN_URL, cancelUrl: CANCEL_URL, amountKobo: 100, currency: "USD" },
  });
  assert.equal(tamperedCheckout.status, 400, `T10b: amount/currency in checkout body → 400 (got ${tamperedCheckout.status})`);
  assert.equal(await prisma.payment.count({ where: { bookingId: t10.bookingId } }), 0, "T10b: no Payment created");

  const co10 = await checkout(t10, "T10");
  const b10 = await dbBooking(t10.bookingId);
  assert.equal(co10.payment.amountKobo, b10.amountKobo, "T10c: Payment amount = frozen booking amount");
  assert.equal(co10.payment.amountKobo, t10.pricing.payableKobo, "T10c: = server-computed payable");
  assert.ok(co10.payment.amountKobo < pkg10.priceKobo, "T10c: below list price (discount is server-side)");
  assert.equal(co10.payment.currency, "NGN");

  // Webhook claiming a different amount must NOT confirm (payment-security rule).
  const wrongAmount = await postWebhook({
    id: `evt_e2e_wrong_amount_${t10.reference}`,
    type: "collection.succeeded",
    reference: t10.reference,
    checkoutId: co10.payment.providerSessionId,
    amountKobo: co10.payment.amountKobo,
    amountOverride: "1.00",
  });
  assert.ok(ok(wrongAmount.status), `T10d: mismatched amount acknowledged (${wrongAmount.status})`);
  assert.equal(wrongAmount.data.ignored, "amount_mismatch", "T10d: flagged amount_mismatch");
  let s10 = await status(t10.bookingId, t10.ip, t10.reference);
  assert.notEqual(s10.status, BookingStatus.CONFIRMED, "T10d: not confirmed on wrong amount");
  assert.notEqual(s10.payment?.status, PaymentStatus.SUCCESS, "T10d: payment not SUCCESS on wrong amount");
  assert.match((await dbBooking(t10.bookingId)).notes ?? "", /AMOUNT_MISMATCH/, "T10d: desk flag written");

  const wrongCurrency = await postWebhook({
    id: `evt_e2e_wrong_currency_${t10.reference}`,
    type: "collection.succeeded",
    reference: t10.reference,
    checkoutId: co10.payment.providerSessionId,
    amountKobo: co10.payment.amountKobo,
    currency: "USD",
  });
  assert.equal(wrongCurrency.data.ignored, "amount_mismatch", "T10e: wrong currency flagged");
  s10 = await status(t10.bookingId, t10.ip, t10.reference);
  assert.notEqual(s10.status, BookingStatus.CONFIRMED, "T10e: not confirmed on wrong currency");

  // checkout.completed without payment must never confirm.
  const unpaidCompleted = await postWebhook({
    id: `evt_e2e_unpaid_completed_${t10.reference}`,
    type: "checkout.completed",
    reference: t10.reference,
    checkoutId: co10.payment.providerSessionId,
    amountKobo: co10.payment.amountKobo,
    extraData: { payment_status: "no_payment_required", charge: null },
  });
  assert.ok(ok(unpaidCompleted.status));
  s10 = await status(t10.bookingId, t10.ip, t10.reference);
  assert.notEqual(s10.status, BookingStatus.CONFIRMED, "T10f: checkout.completed w/o payment does not confirm");

  // Correct amount + currency (new event id) confirms.
  const rightAmount = await postWebhook({
    id: `evt_e2e_right_amount_${t10.reference}`,
    type: "collection.succeeded",
    reference: t10.reference,
    checkoutId: co10.payment.providerSessionId,
    amountKobo: co10.payment.amountKobo,
  });
  assert.ok(ok(rightAmount.status));
  assert.notEqual(rightAmount.data.ignored, "amount_mismatch");
  s10 = await status(t10.bookingId, t10.ip, t10.reference);
  assert.equal(s10.status, BookingStatus.CONFIRMED, "T10g: matching amount confirms");
  assert.equal(s10.payment?.status, PaymentStatus.SUCCESS);
  console.log("  ✓ body fields rejected · amount frozen server-side · wrong amount/currency never confirms");

  console.log(`\nAll Bachs E2E tests passed (${mode} mode).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
