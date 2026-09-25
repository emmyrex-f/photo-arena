/**
 * Verification script for Customer Self-Service Booking Features (B5, B6, B7)
 * & Strict No-Refund / Contract Penalty & Reschedule Policy.
 */
import { PrismaClient, BookingStatus, PaymentStatus } from "@prisma/client";

const prisma = new PrismaClient();
const API_URL = "http://localhost:3001/api";

async function run() {
  console.log("Starting verification of Booking Self-Service (B5, B6, B7) & No-Refund Policy...");

  // 1. Get an active package & main studio resource
  const pkg = await prisma.package.findFirst({
    where: { isActive: true, durationMinutes: 60 },
  }) || (await prisma.package.findFirst({ where: { isActive: true } }));
  if (!pkg) throw new Error("No active package found");

  const resource = await prisma.studioResource.findFirst({ where: { isActive: true } });
  if (!resource) throw new Error("No active resource found");

  const testEmail = `self-service-${Date.now()}@example.com`;
  const testPhone = `080${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testRef = `PA-TEST-${Date.now()}`;

  // Customer
  const customer = await prisma.customer.create({
    data: {
      name: "Chukwudi Okafor",
      email: testEmail,
      phone: testPhone,
    },
  });

  // Future booking slot (5 days from now at 14:00 Lagos time)
  const slotDate = new Date(Date.now() + 5 * 24 * 3600 * 1000);
  slotDate.setUTCHours(13, 0, 0, 0); // 14:00 WAT
  const slotEnd = new Date(slotDate.getTime() + pkg.durationMinutes * 60_000);

  const booking = await prisma.booking.create({
    data: {
      customerId: customer.id,
      packageId: pkg.id,
      resourceId: resource.id,
      startTime: slotDate,
      endTime: slotEnd,
      status: BookingStatus.CONFIRMED,
      source: "ONLINE",
      amountKobo: pkg.priceKobo,
      reference: testRef,
      contactEmail: customer.email,
    },
    include: { customer: true, package: true, payments: true },
  });

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      amountKobo: pkg.priceKobo,
      currency: "NGN",
      status: PaymentStatus.SUCCESS,
      method: "ONLINE_BACHS",
      provider: "mock",
      reference: `pay_${testRef}`,
      paidAt: new Date(),
    },
  });

  console.log(`✓ Step 1: Created test confirmed booking: ${booking.reference} (Paid: ₦${(pkg.priceKobo / 100).toLocaleString()})`);

  // Step 2: Public lookup without verification
  const lookupRes1 = await fetch(`${API_URL}/bookings/lookup?reference=${testRef}`);
  if (!lookupRes1.ok) {
    throw new Error(`Lookup failed with status ${lookupRes1.status}: ${await lookupRes1.text()}`);
  }
  const lookupData1 = await lookupRes1.json();
  if (lookupData1.reference !== testRef || lookupData1.status !== "CONFIRMED") {
    throw new Error("Lookup data mismatch");
  }
  if (!lookupData1.customer.maskedEmail.includes("***")) {
    throw new Error("Customer email was not properly masked");
  }
  if (lookupData1.pricing.cancellationPenaltyKobo !== pkg.priceKobo) {
    throw new Error(`Expected 100% cancellation penalty, got ${lookupData1.pricing.cancellationPenaltyKobo}`);
  }
  if (lookupData1.pricing.eligibleRefundKobo !== 0) {
    throw new Error(`Expected ₦0 refund under strict no-refund policy, got ${lookupData1.pricing.eligibleRefundKobo}`);
  }
  console.log("✓ Step 2: Public lookup returned sanitized booking with strict no-refund penalty breakdown");

  // Step 3: Lookup with correct customer verification
  const lookupRes2 = await fetch(`${API_URL}/bookings/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference: testRef, emailOrPhone: testEmail }),
  });
  if (!lookupRes2.ok) throw new Error("Verified lookup failed");
  const lookupData2 = await lookupRes2.json();
  if (!lookupData2.customer.isVerified) {
    throw new Error("Customer was not marked verified");
  }
  console.log("✓ Step 3: Verified lookup succeeded with customer match");

  // Step 4: Lookup with wrong verification -> 403
  const lookupRes3 = await fetch(`${API_URL}/bookings/lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference: testRef, emailOrPhone: "wrong@example.com" }),
  });
  if (lookupRes3.status !== 403) {
    throw new Error(`Expected 403 for mismatched customer, got ${lookupRes3.status}`);
  }
  console.log("✓ Step 4: Wrong customer credentials properly rejected with 403 Forbidden");

  // Step 5: Customer Reschedule with 15% reschedule fee
  let newSlotIso = "";
  for (let offset = 8; offset < 16; offset++) {
    const d = new Date(Date.now() + offset * 86400000);
    const ymd = d.toISOString().slice(0, 10);
    const availRes = await fetch(`${API_URL}/bookings/availability?date=${ymd}&durationMinutes=${pkg.durationMinutes}`);
    if (availRes.ok) {
      const avail = await availRes.json();
      if (avail.slots && avail.slots.length > 0) {
        newSlotIso = avail.slots[0];
        break;
      }
    }
  }
  if (!newSlotIso) throw new Error("No available slots found for rescheduling");

  const rescheduleRes = await fetch(`${API_URL}/bookings/customer-reschedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reference: testRef,
      emailOrPhone: testPhone,
      newStartTime: newSlotIso,
      reason: "Traveling out of town on original date",
    }),
  });
  if (!rescheduleRes.ok) {
    throw new Error(`Customer reschedule failed: ${await rescheduleRes.text()}`);
  }
  const rescheduleData = await rescheduleRes.json();
  const expectedFeeKobo = Math.floor((pkg.priceKobo * 1500) / 10_000);
  if (rescheduleData.rescheduleFeeKobo !== expectedFeeKobo) {
    throw new Error(`Expected 15% reschedule fee (₦${expectedFeeKobo / 100}), got ₦${rescheduleData.rescheduleFeeKobo / 100}`);
  }
  console.log(`✓ Step 5: Customer reschedule successful with 15% fee: ₦${(expectedFeeKobo / 100).toLocaleString()}`);

  // Step 6: Checkout for outstanding reschedule fee
  const checkoutRes = await fetch(`${API_URL}/bookings/customer-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reference: testRef,
      emailOrPhone: testEmail,
      returnUrl: "http://localhost:5173/book/confirmation",
      cancelUrl: "http://localhost:5173/booking/lookup",
    }),
  });
  if (!checkoutRes.ok) {
    throw new Error(`Customer checkout failed: ${await checkoutRes.text()}`);
  }
  const checkoutData = await checkoutRes.json();
  if (!checkoutData.checkoutUrl || checkoutData.amountKobo !== expectedFeeKobo) {
    throw new Error("Customer checkout payload invalid");
  }
  console.log(`✓ Step 6: Online checkout session created for pending reschedule fee (₦${(checkoutData.amountKobo / 100).toLocaleString()})`);

  // Step 7: Customer Cancellation under Strict No Refund Policy
  const cancelRes = await fetch(`${API_URL}/bookings/customer-cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reference: testRef,
      emailOrPhone: testEmail,
      reason: "Emergency schedule conflict",
    }),
  });
  if (!cancelRes.ok) {
    throw new Error(`Customer cancellation failed: ${await cancelRes.text()}`);
  }
  const cancelData = await cancelRes.json();
  if (cancelData.status !== "CANCELLED" || cancelData.eligibleRefundKobo !== 0) {
    throw new Error("Cancellation output violated strict no-refund policy");
  }
  console.log(`✓ Step 7: Booking cancelled under strict no-refund contract policy (Forfeit penalty: ₦${(cancelData.penaltyKobo / 100).toLocaleString()}, Refund: ₦0)`);

  // Step 8: Repeat cancellation attempt -> 400
  const repeatCancelRes = await fetch(`${API_URL}/bookings/customer-cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reference: testRef,
      emailOrPhone: testEmail,
    }),
  });
  if (repeatCancelRes.status !== 400) {
    throw new Error(`Expected 400 for already cancelled booking, got ${repeatCancelRes.status}`);
  }
  console.log("✓ Step 8: Double cancellation properly rejected with 400 Bad Request");

  // Cleanup
  await prisma.payment.deleteMany({ where: { bookingId: booking.id } });
  await prisma.booking.deleteMany({
    where: { OR: [{ id: booking.id }, { customerId: customer.id }] },
  });
  await prisma.customer.delete({ where: { id: customer.id } });
  console.log("✓ Cleanup: Removed test data");

  console.log("\n==============================================");
  console.log("ALL BOOKING SELF-SERVICE (B5, B6, B7) & NO-REFUND TESTS PASSED 100%");
  console.log("==============================================\n");
}

run()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
