import "./load-env";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { signBachsWebhookForTest } from "../src/payments/bachs-webhook";

const prisma = new PrismaClient();
const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");
const WEBHOOK_SECRET =
  process.env.BACHS_WEBHOOK_SECRET?.trim() || "whsec_local_photo_arena_dev";

async function main() {
  console.log("\n========================================================");
  console.log("🔍 VERIFICATION: NO HOLD FEATURE / NO HOLD EMAIL DISPATCH");
  console.log("========================================================\n");

  // Step 1: Find an available package & open slot
  const packagesRes = await fetch(`${API_BASE}/bookings/packages`);
  const packagesData = (await packagesRes.json()) as any[];
  assert.ok(packagesData.length > 0, "Packages must exist");
  const pkg = packagesData[0].packages[0];

  const now = new Date();
  const randomDaysAhead = 4 + Math.floor(Math.random() * 10);
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now.getTime() + 86400000 * randomDaysAhead));

  const availRes = await fetch(
    `${API_BASE}/bookings/availability?date=${encodeURIComponent(dateStr)}&durationMinutes=${pkg.durationMinutes}`,
  );
  const availData = (await availRes.json()) as { slots: string[] };
  assert.ok(availData.slots?.length > 0, `Should have available slot on ${dateStr}`);
  const slot = availData.slots[Math.floor(Math.random() * availData.slots.length)];

  const testEmail = `verify-no-hold-${Date.now()}@example.com`;
  const testPhone = `080${Math.floor(10000000 + Math.random() * 90000000)}`;

  console.log("1️⃣ Triggering slot reservation checkout creation...");
  const holdRes = await fetch(`${API_BASE}/bookings/hold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      packageId: pkg.id,
      startTime: slot,
      customerName: "No Hold Email Tester",
      customerPhone: testPhone,
      customerEmail: testEmail,
    }),
  });
  const holdData = (await holdRes.json()) as any;
  assert.equal(holdRes.status, 201, `Hold endpoint returned ${holdRes.status}: ${JSON.stringify(holdData)}`);
  console.log(`   ✅ Slot reserved (Booking ID: ${holdData.bookingId}, Ref: ${holdData.reference})`);

  // Step 2: Verify NO email notification was created in the database for this hold
  console.log("\n2️⃣ Checking Notification Log in database for hold event...");
  // Give background async tasks 500ms
  await new Promise((r) => setTimeout(r, 500));

  const holdNotification = await prisma.notificationLog.findFirst({
    where: {
      OR: [
        { to: testEmail },
        { payload: { contains: holdData.bookingId } },
        { payload: { contains: holdData.reference } },
      ],
      event: "booking_created",
    },
  });

  assert.equal(
    holdNotification,
    null,
    "❌ FAILURE: A hold email notification was found in the database!",
  );
  console.log("   ✅ CONFIRMED: No hold email / booking_created notification was logged or sent.");

  console.log("\n2b️⃣ Second customer tries the same slot...");
  const secondRes = await fetch(`${API_BASE}/bookings/hold`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      packageId: pkg.id,
      startTime: slot,
      customerName: "Second Customer",
      customerPhone: `081${Math.floor(10000000 + Math.random() * 90000000)}`,
      customerEmail: `verify-second-${Date.now()}@example.com`,
    }),
  });
  const secondData = (await secondRes.json()) as { message?: string };
  assert.equal(secondRes.status, 409, `Second customer should get 409, got ${secondRes.status}`);
  assert.match(String(secondData.message), /just booked.*pick another/i);
  console.log(`   ✅ Second customer told: "${secondData.message}"`);

  console.log("\n2c️⃣ Expiring the first hold — checkout must renew it, not reject...");
  await prisma.booking.update({
    where: { id: holdData.bookingId },
    data: { holdExpiresAt: new Date(Date.now() - 60_000) },
  });

  // Step 3: Trigger checkout (as frontend immediately does) and simulate payment webhook
  console.log("\n3️⃣ Initializing checkout and simulating payment webhook...");
  const checkoutRes = await fetch(`${API_BASE}/bookings/${holdData.bookingId}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reference: holdData.reference,
      returnUrl: "http://localhost:5173/book/confirmation",
      cancelUrl: "http://localhost:5173/book",
    }),
  });
  const checkoutData = (await checkoutRes.json()) as any;
  assert.equal(checkoutRes.status, 201, `Checkout returned ${checkoutRes.status}: ${JSON.stringify(checkoutData)}`);
  const renewed = await prisma.booking.findUniqueOrThrow({ where: { id: holdData.bookingId } });
  assert.equal(renewed.status, "TEMPORARY_HOLD");
  assert.ok(renewed.holdExpiresAt && renewed.holdExpiresAt.getTime() > Date.now(), "Hold should be renewed");
  console.log("   ✅ Expired hold renewed at checkout (customer not blocked).");
  console.log(`   ✅ Checkout session created (Checkout URL: ${checkoutData.checkoutUrl})`);

  const webhookNow = Math.floor(Date.now() / 1000);
  const webhookPayload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    type: "collection.succeeded",
    created_at: new Date().toISOString(),
    data: {
      charge_id: `ch_${Date.now()}`,
      checkout_id: `chk_${Date.now()}`,
      reference: holdData.reference,
      status: "SUCCEEDED",
      amount: (holdData.pricing.payableKobo / 100).toFixed(2),
      currency: "NGN",
      metadata: { reference: holdData.reference },
    },
  });
  const signed = signBachsWebhookForTest(webhookPayload, WEBHOOK_SECRET, webhookNow);

  const webhookRes = await fetch(`${API_BASE}/payments/webhook/bachs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bachs-signature-v2": signed.signatureV2,
    },
    body: webhookPayload,
  });
  assert.ok(
    webhookRes.status === 200 || webhookRes.status === 201,
    `Webhook returned ${webhookRes.status}`,
  );
  console.log("   ✅ Webhook processed successfully.");

  // Step 4: Verify booking_confirmed notification WAS sent upon payment (dispatch is async)
  let confirmedNotification = null;
  for (let i = 0; i < 20 && !confirmedNotification; i++) {
    await new Promise((r) => setTimeout(r, 500));
    confirmedNotification = await prisma.notificationLog.findFirst({
      where: { to: testEmail, event: "booking_confirmed" },
    });
  }

  assert.ok(
    confirmedNotification,
    "❌ FAILURE: Booking confirmed email should be sent after payment!",
  );
  console.log(
    `   ✅ CONFIRMED: Booking confirmation email was dispatched to ${testEmail} after payment.\n`,
  );

  console.log("🎉 ALL VERIFICATIONS PASSED: No hold email is dispatched during checkout; only confirmation is sent upon payment.\n");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ Verification error:", err);
  process.exit(1);
});
