import assert from "assert";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API_URL = "http://localhost:3001/api";

async function main() {
  console.log("Starting admin booking verification...");

  // 1. Owner login
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SEED_OWNER_EMAIL ?? "owner@photoarenang.com",
      password: process.env.SEED_OWNER_PASSWORD ?? "changeme",
    }),
  });
  assert.ok(loginRes.status === 200 || loginRes.status === 201, `Login failed: ${loginRes.status}`);
  const loginData = await loginRes.json();
  const token = loginData.token;
  assert.ok(token, "Login must return JWT token");
  console.log("✓ Step 1: Owner login successful");

  // 2. Fetch packages
  const packagesRes = await fetch(`${API_URL}/admin/packages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(packagesRes.status, 200);
  const packages = await packagesRes.json();
  assert.ok(Array.isArray(packages) && packages.length > 0, "Must return active packages");
  const pkg = packages[0];
  console.log(`✓ Step 2: Fetched ${packages.length} active packages (using: ${pkg.name})`);

  // 3. Fetch availability — scan upcoming weekdays for free slots
  let ymd = "";
  let slot = "";
  for (let add = 1; add <= 14; add += 1) {
    const d = new Date();
    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7) + (add - 1));
    const candidate = d.toISOString().slice(0, 10);
    const availRes = await fetch(
      `${API_URL}/admin/availability?date=${candidate}&durationMinutes=${pkg.durationMinutes}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.strictEqual(availRes.status, 200);
    const avail = await availRes.json();
    if (Array.isArray(avail.slots) && avail.slots.length > 0) {
      ymd = candidate;
      slot = avail.slots[0];
      break;
    }
  }
  assert.ok(ymd && slot, "Must have available slots in the next two weeks");
  console.log(`✓ Step 3: Availability check found slots for ${ymd} (selected: ${slot})`);

  // 4. Create admin walk-in booking
  const testPhone = "08039998877";
  const createRes = await fetch(`${API_URL}/admin/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      customerName: "Admin Test Customer",
      customerPhone: testPhone,
      customerEmail: "admintest@example.com",
      packageId: pkg.id,
      startTime: slot,
      source: "WALK_IN",
      notes: "Walk-in created by admin desk",
    }),
  });

  const created = await createRes.json();
  assert.strictEqual(createRes.status, 201, `Create booking failed: ${JSON.stringify(created)}`);
  assert.ok(created.id, "Booking must have an id");
  assert.strictEqual(created.status, "PENDING", "Admin booking starts as PENDING");
  assert.strictEqual(created.source, "WALK_IN");
  assert.ok(created.reference, "Must generate reference code");
  console.log(`✓ Step 4: Walk-in booking created (ref: ${created.reference}, ID: ${created.id})`);

  // 5. Record immediate studio payment (POS)
  const payRes = await fetch(`${API_URL}/admin/bookings/${created.id}/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      amountKobo: pkg.priceKobo,
      channel: "POS",
      reference: `POS-TEST-${Date.now()}`,
      note: "Collected at front desk",
    }),
  });
  assert.strictEqual(payRes.status, 201, `Record payment failed: ${payRes.status}`);
  const payData = await payRes.json();
  assert.ok(payData.id, "Must return updated booking");
  const successPayment = payData.payments?.find(
    (p: { status: string; channel?: string }) => p.status === "SUCCESS" && p.channel === "POS",
  );
  assert.ok(successPayment, "Must include successful POS payment record");
  console.log(`✓ Step 5: Studio POS payment of ₦${(pkg.priceKobo / 100).toLocaleString()} successfully recorded`);

  // 6. Cleanup test records
  await prisma.payment.deleteMany({ where: { bookingId: created.id } });
  await prisma.booking.delete({ where: { id: created.id } });
  await prisma.customer.deleteMany({ where: { phone: testPhone } });
  console.log("✓ Step 6: Test data cleaned up cleanly");

  console.log("\n==========================================");
  console.log("🎉 ADMIN BOOKING FEATURE VERIFIED 100%!");
  console.log("==========================================");
}

main()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
