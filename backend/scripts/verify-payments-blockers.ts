import "./load-env";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { signBachsWebhookForTest } from "../src/payments/bachs-webhook";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");

async function api<T = unknown>(
  method: string,
  path: string,
  opts?: { body?: unknown; token?: string; headers?: Record<string, string> },
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { ...(opts?.headers ?? {}) };
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts?.body !== undefined && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts?.body) : undefined,
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

async function main() {
  console.log("Starting verification of Payments Blockers (P1, P2, P3)...");
  const prisma = new PrismaClient();

  try {
    const deskEmailRes = await api<{ email: string }>("GET", "/auth/desk-email");
    const ownerEmail = (deskEmailRes.data?.email || process.env.SEED_OWNER_EMAIL || "owner@photoarenang.com").trim().toLowerCase();
    const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme";

    // 1. Owner Login
    const ownerLogin = await api<{ token: string; user: { id: string } }>("POST", "/auth/login", {
      body: { email: ownerEmail, password: ownerPassword },
    });
    assert.equal(ownerLogin.status, 201, `Owner login failed: ${JSON.stringify(ownerLogin.data)}`);
    const ownerToken = ownerLogin.data.token;
    console.log("✓ Step 1: Owner authenticated");

    // 2. Fetch active package
    const pkg = await prisma.package.findFirst({
      where: { isActive: true, priceKobo: { gt: 0 } },
    });
    assert.ok(pkg, "Active package must exist");
    const totalDueKobo = pkg.priceKobo;
    console.log(`✓ Step 2: Found package: ${pkg.name} (₦${(totalDueKobo / 100).toLocaleString()})`);

    // 3. Create Admin Walk-in Booking on a free slot
    const stamp = Date.now();
    const avail = await api<{ slots: string[] }>(
      "GET",
      `/admin/availability?date=2026-10-15&durationMinutes=${pkg.durationMinutes}`,
      { token: ownerToken },
    );
    assert.equal(avail.status, 200, `availability ${avail.status}`);
    assert.ok(avail.data.slots?.length, "Need a free slot for payments blockers test");
    const bookingDate = avail.data.slots[0];
    const adminBooking = await api<{ id: string; status: string; customer: { name: string } }>(
      "POST",
      "/admin/bookings",
      {
        token: ownerToken,
        body: {
          customerName: `Walkin Cust ${stamp}`,
          customerPhone: `+23480${String(stamp).slice(-8)}`,
          customerEmail: `walkin-${stamp}@dammy-ray.com.ng`,
          packageId: pkg.id,
          startTime: bookingDate,
          source: "WALK_IN",
          notes: "Walk-in deposit test",
        },
      },
    );
    assert.equal(adminBooking.status, 201, `Admin booking failed: ${JSON.stringify(adminBooking.data)}`);
    const bookingId = adminBooking.data.id;
    console.log("✓ Step 3: Admin walk-in booking created:", bookingId);

    // 4. Test Partial Studio Payment (POS Deposit)
    const depositKobo = Math.floor(totalDueKobo / 2);
    const posRef = `POS-RRN-${stamp}`;
    const depositRes = await api<{ id: string; status: string; payments: Array<{ id: string; amountKobo: number; channel?: string; status: string }> }>(
      "POST",
      `/admin/bookings/${bookingId}/payment`,
      {
        token: ownerToken,
        body: {
          amountKobo: depositKobo,
          channel: "POS",
          reference: posRef,
          note: "50% deposit via POS terminal 1",
        },
      },
    );
    assert.equal(depositRes.status, 201, `Deposit failed: ${JSON.stringify(depositRes.data)}`);
    assert.equal(depositRes.data.status, "CONFIRMED", "Booking must be confirmed after deposit");
    const depositPayment = depositRes.data.payments.find((p) => p.reference === posRef || p.amountKobo === depositKobo);
    assert.ok(depositPayment, "Deposit payment record must be created");
    assert.equal(depositPayment.amountKobo, depositKobo);
    console.log(`✓ Step 4: Partial deposit recorded via POS: ₦${(depositKobo / 100).toLocaleString()} (Booking CONFIRMED)`);

    // 5. Test Overpayment Rejection
    const remainingKobo = totalDueKobo - depositKobo;
    const overpayRes = await api(
      "POST",
      `/admin/bookings/${bookingId}/payment`,
      {
        token: ownerToken,
        body: {
          amountKobo: remainingKobo + 100000,
          channel: "CASH",
        },
      },
    );
    assert.equal(overpayRes.status, 400, "Overpayment must be rejected with 400");
    console.log("✓ Step 5: Overpayment properly rejected with 400 Bad Request");

    // 6. Record Final Balance Payment (CASH) on CONFIRMED booking
    const balanceRes = await api<{ id: string; payments: Array<{ id: string; amountKobo: number; channel?: string; status: string }> }>(
      "POST",
      `/admin/bookings/${bookingId}/payment`,
      {
        token: ownerToken,
        body: {
          amountKobo: remainingKobo,
          channel: "CASH",
          note: "Cash balance paid at reception",
        },
      },
    );
    assert.equal(balanceRes.status, 201);
    const allPayments = balanceRes.data.payments.filter((p) => p.status === "SUCCESS");
    const totalPaid = allPayments.reduce((sum, p) => sum + p.amountKobo, 0);
    assert.equal(totalPaid, totalDueKobo, "Booking must be fully paid");
    console.log(`✓ Step 6: Final balance payment recorded via CASH on CONFIRMED booking (Total paid: ₦${(totalPaid / 100).toLocaleString()})`);

    // 7. Test Admin Refund: Partial Refund on POS Payment
    const firstPayment = await prisma.payment.findFirst({
      where: { bookingId, amountKobo: depositKobo },
    });
    assert.ok(firstPayment, "First payment must exist");

    const partialRefundKobo = 50000; // 500 NGN
    // 7. Verify Strict No-Refund Policy Enforcement (Must reject with 400 Bad Request)
    const refundAttemptRes = await api(
      "POST",
      `/admin/payments/${firstPayment.id}/refund`,
      {
        token: ownerToken,
        body: {
          amountKobo: partialRefundKobo,
          reason: "Customer requested refund",
        },
      },
    );
    assert.equal(refundAttemptRes.status, 400, "Refunds must be rejected with 400 Bad Request");
    console.log("✓ Step 7: Refund attempt rejected with 400 (Strict no-refund policy enforced)");

    // 8. Create a Temporary Hold Booking and Pending Online Payment to test Abandon Process
    const webhookPaymentRef = `wh-abandon-ref-${stamp}`;
    const webhookBooking = await prisma.booking.create({
      data: {
        packageId: pkg.id,
        customerId: (await prisma.customer.findFirst({ where: { phone: "+2348012345678" } }))!.id,
        resourceId: (await prisma.studioResource.findFirst())!.id,
        startTime: new Date("2026-10-16T14:00:00.000Z"),
        endTime: new Date("2026-10-16T15:00:00.000Z"),
        status: "TEMPORARY_HOLD",
        source: "ONLINE",
        reference: webhookPaymentRef,
        amountKobo: 5000000,
        contactEmail: "client@example.com",
      },
    });

    const whPayment = await prisma.payment.create({
      data: {
        bookingId: webhookBooking.id,
        amountKobo: 5000000,
        currency: "NGN",
        status: "PENDING",
        method: "ONLINE_BACHS",
        provider: "bachs",
        reference: webhookPaymentRef,
      },
    });
    console.log("✓ Step 8: Created temporary hold booking & pending online payment");

    // 9. Send Signed collection.abandoned Webhook
    const webhookSecret = (process.env.BACHS_WEBHOOK_SECRET ?? "change-me-to-a-random-hex-string").trim();
    const abandonEventPayload = JSON.stringify({
      id: `evt_abandon_${stamp}`,
      type: "collection.abandoned",
      data: {
        reference: webhookPaymentRef,
        amount: "50000.00",
        currency: "NGN",
      },
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const sigHeaders = signBachsWebhookForTest(abandonEventPayload, webhookSecret, nowSec);

    const webhookRes = await api<{ received: boolean; duplicate?: boolean }>(
      "POST",
      "/payments/webhook/bachs",
      {
        body: JSON.parse(abandonEventPayload),
        headers: {
          "x-bachs-signature": sigHeaders.signature,
          "x-bachs-signature-v2": sigHeaders.signatureV2,
          "x-bachs-timestamp": sigHeaders.timestamp,
        },
      },
    );
    assert.equal(webhookRes.status, 201, `Webhook call failed: ${JSON.stringify(webhookRes.data)}`);
    assert.equal(webhookRes.data.received, true);

    // 10. Verify Payment Marked FAILED, Booking Marked CANCELLED (Hold Released), and Notification Dispatched
    const dbAbandonedPayment = await prisma.payment.findUnique({ where: { id: whPayment.id } });
    assert.equal(dbAbandonedPayment?.status, "FAILED", "Abandoned payment must be marked FAILED");

    const dbCancelledBooking = await prisma.booking.findUnique({ where: { id: webhookBooking.id } });
    assert.equal(dbCancelledBooking?.status, "CANCELLED", "Temporary hold must be cancelled on abandon");

    const notifLog = await prisma.notificationLog.findFirst({
      where: { event: "checkout_abandoned" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(notifLog, "A checkout_abandoned notification log must be created");
    console.log("✓ Step 10: Signed collection.abandoned processed: payment FAILED, hold released, customer/admin notified");

    // 11. Test Webhook Replay Deduplication
    const replayRes = await api<{ received: boolean; duplicate?: boolean }>(
      "POST",
      "/payments/webhook/bachs",
      {
        body: JSON.parse(abandonEventPayload),
        headers: {
          "x-bachs-signature": sigHeaders.signature,
          "x-bachs-signature-v2": sigHeaders.signatureV2,
          "x-bachs-timestamp": sigHeaders.timestamp,
        },
      },
    );
    assert.equal(replayRes.status, 201);
    assert.equal(replayRes.data.duplicate, true, "Replayed webhook must return duplicate: true");
    console.log("✓ Step 11: Webhook deduplication / replay idempotency verified");

    // Cleanup test bookings
    await prisma.payment.deleteMany({ where: { bookingId: { in: [bookingId, webhookBooking.id] } } });
    await prisma.booking.deleteMany({ where: { id: { in: [bookingId, webhookBooking.id] } } });
    await prisma.processedWebhookEvent.deleteMany({ where: { id: `evt_abandon_${stamp}` } });
    console.log("✓ Cleanup: Removed test bookings & payments");

    console.log("\n==============================================");
    console.log("ALL PAYMENT BLOCKER (P1, P2, P3, P4) TESTS PASSED 100%");
    console.log("==============================================\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
