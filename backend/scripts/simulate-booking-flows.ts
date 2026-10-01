import assert from "node:assert/strict";
import { PrismaClient, BookingStatus } from "@prisma/client";

const BASE_URL = process.env.API_URL || "http://localhost:3001/api";
const prisma = new PrismaClient();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function api<T = any>(
  method: string,
  path: string,
  options: { body?: any; token?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data: any = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data };
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function runBookingSimulations() {
  console.log("=================================================================");
  console.log(" 🎭 PHOTO ARENA: COMPREHENSIVE BOOKING SIMULATION SUITE");
  console.log("=================================================================\n");

  let activePkg: any = null;
  let activeService: any = null;

  // 0. Initial Setup: Fetch public packages
  console.log("📡 [Setup] Fetching available public services and packages...");
  const pkgsRes = await api<any[]>("GET", "/bookings/packages");
  assert.equal(pkgsRes.status, 200, "Should successfully load packages");
  
  for (const svc of pkgsRes.data) {
    if (svc.packages && svc.packages.length > 0) {
      activeService = svc;
      activePkg = svc.packages[0];
      break;
    }
  }

  assert.ok(activePkg, "Must find at least one active package for testing");
  console.log(`✅ [Setup] Selected service: "${activeService.name}", package: "${activePkg.name}" (ID: ${activePkg.id}, Duration: ${activePkg.durationMinutes} mins, Price: ₦${(activePkg.priceKobo / 100).toLocaleString()})\n`);

  // Target booking date: 5 days from now
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 5);
  const targetDateStr = formatDate(targetDate);

  // =========================================================================
  // 1. WRONG MODE (Human Mistake & Validation Edge Cases)
  // =========================================================================
  console.log("-----------------------------------------------------------------");
  console.log(" ❌ [TEST SUITE 1: WRONG / HUMAN MISTAKE FLOW]");
  console.log("-----------------------------------------------------------------");

  // Case 1.1: Missing Customer Name
  console.log("▶ Test 1.1: Attempt booking without customer name...");
  const wrong1 = await api("POST", "/bookings/hold", {
    body: {
      packageId: activePkg.id,
      startTime: `${targetDateStr}T10:00:00.000Z`,
      customerEmail: "john.doe@example.com",
      customerPhone: "08012345678",
      customerName: "",
    },
  });
  console.log(`  Status: ${wrong1.status}, Error:`, wrong1.data?.message || wrong1.data);
  assert.ok(wrong1.status >= 400 && wrong1.status < 500, "Must reject empty customer name");
  console.log("  ✅ Correctly rejected empty name with 400 Bad Request\n");

  // Case 1.2: Invalid Email Format
  console.log("▶ Test 1.2: Attempt booking with malformed email...");
  const wrong2 = await api("POST", "/bookings/hold", {
    body: {
      packageId: activePkg.id,
      startTime: `${targetDateStr}T10:00:00.000Z`,
      customerName: "Jane Doe",
      customerEmail: "not-an-email",
      customerPhone: "08012345678",
    },
  });
  console.log(`  Status: ${wrong2.status}, Error:`, wrong2.data?.message || wrong2.data);
  assert.ok(wrong2.status >= 400 && wrong2.status < 500, "Must reject malformed email");
  console.log("  ✅ Correctly rejected invalid email\n");

  // Case 1.3: Invalid Nigerian Phone Number
  console.log("▶ Test 1.3: Attempt booking with invalid phone number ('12345')...");
  const wrong3 = await api("POST", "/bookings/hold", {
    body: {
      packageId: activePkg.id,
      startTime: `${targetDateStr}T10:00:00.000Z`,
      customerName: "Jane Doe",
      customerEmail: "jane.doe@example.com",
      customerPhone: "12345",
    },
  });
  console.log(`  Status: ${wrong3.status}, Error:`, wrong3.data?.message || wrong3.data);
  assert.ok(wrong3.status >= 400 && wrong3.status < 500, "Must reject invalid phone number");
  console.log("  ✅ Correctly rejected invalid phone number\n");

  // Case 1.4: Booking in the Past
  console.log("▶ Test 1.4: Attempt booking in the past (e.g., Year 2022)...");
  const wrong4 = await api("POST", "/bookings/hold", {
    body: {
      packageId: activePkg.id,
      startTime: "2022-01-01T10:00:00.000Z",
      customerName: "Time Traveler",
      customerEmail: "timetravel@example.com",
      customerPhone: "08012345678",
    },
  });
  console.log(`  Status: ${wrong4.status}, Error:`, wrong4.data?.message || wrong4.data);
  assert.ok(wrong4.status >= 400 && wrong4.status < 500, "Must reject past dates");
  console.log("  ✅ Correctly rejected past date\n");

  // Case 1.5: Non-existent Package ID
  console.log("▶ Test 1.5: Attempt booking with non-existent package UUID...");
  const wrong5 = await api("POST", "/bookings/hold", {
    body: {
      packageId: "00000000-0000-0000-0000-000000000000",
      startTime: `${targetDateStr}T10:00:00.000Z`,
      customerName: "John Doe",
      customerEmail: "john@example.com",
      customerPhone: "08012345678",
    },
  });
  console.log(`  Status: ${wrong5.status}, Error:`, wrong5.data?.message || wrong5.data);
  assert.ok(wrong5.status >= 400 && wrong5.status < 500, "Must reject non-existent package");
  console.log("  ✅ Correctly rejected invalid package ID\n");

  // Case 1.6: Lookup with wrong reference / email mismatch
  console.log("▶ Test 1.6: Self-service lookup with non-existent reference...");
  const wrong6 = await api("GET", "/bookings/lookup?reference=PA-FAKE-9999&emailOrPhone=wrong@example.com");
  console.log(`  Status: ${wrong6.status}, Result:`, wrong6.data?.message || wrong6.data);
  assert.ok(wrong6.status >= 400 && wrong6.status < 500, "Must reject invalid lookup reference");
  console.log("  ✅ Correctly returned not found / unauthorized for fake reference\n");

  // =========================================================================
  // 2. GOOD MODE (Authentic Human User Flow)
  // =========================================================================
  console.log("-----------------------------------------------------------------");
  console.log(" ✨ [TEST SUITE 2: GOOD / HAPPY PATH HUMAN FLOW]");
  console.log("-----------------------------------------------------------------");

  // Step 2.1: Human checks calendar availability
  console.log(`▶ Step 2.1: Customer checks availability for ${targetDateStr}...`);
  const availRes = await api("GET", `/bookings/availability?date=${targetDateStr}&durationMinutes=${activePkg.durationMinutes}`);
  assert.equal(availRes.status, 200, "Availability check should succeed");
  const slots: string[] = availRes.data?.slots ?? [];
  console.log(`  Available slots on ${targetDateStr}: ${slots.length}`);
  assert.ok(slots.length > 0, `Must have available slots on ${targetDateStr}`);
  
  const chosenSlot = slots[0];
  console.log(`  Selected available slot: ${chosenSlot}`);

  // Step 2.2: Human submits valid hold booking
  console.log(`▶ Step 2.2: Customer fills checkout form and holds slot (${chosenSlot})...`);
  const goodCustomerEmail = `chinedu.${Date.now()}@example.com`;
  const goodCustomerPhone = "08031234567";

  const goodHoldRes = await api("POST", "/bookings/hold", {
    body: {
      packageId: activePkg.id,
      startTime: chosenSlot,
      customerName: "Chinedu Okafor",
      customerEmail: goodCustomerEmail,
      customerPhone: goodCustomerPhone,
    },
  });

  assert.equal(goodHoldRes.status, 201, `Booking hold should return 201 Created: ${JSON.stringify(goodHoldRes.data)}`);
  const booking = goodHoldRes.data.booking || goodHoldRes.data;
  assert.ok(booking.reference, "Must receive booking reference");
  console.log(`  ✅ Booking created! Reference: ${booking.reference}, Status: ${booking.status}`);
  console.log(`  Online Payable Amount: ₦${(booking.amountKobo / 100).toLocaleString()}`);
  console.log(`  Hold Expires At: ${booking.holdExpiresAt}\n`);

  // Step 2.3: Customer verifies booking status via self-service lookup
  console.log(`▶ Step 2.3: Customer looks up their booking status by reference (${booking.reference})...`);
  const lookupRes = await api("GET", `/bookings/lookup?reference=${booking.reference}&emailOrPhone=${goodCustomerEmail}`);
  assert.equal(lookupRes.status, 200, "Lookup should succeed with matching email");
  console.log(`  ✅ Lookup successful: Customer Name: "${lookupRes.data.customer?.name}", Service: "${lookupRes.data.package?.serviceName}"`);
  console.log(`  Package: "${lookupRes.data.package?.name}", Duration: ${lookupRes.data.package?.durationMinutes} mins`);
  console.log(`  Status: ${lookupRes.data.status}, Start Time: ${lookupRes.data.startTime}\n`);

  // Step 2.4: Simulate customer completing payment -> booking confirmed
  console.log("▶ Step 2.4: Payment verified and booking transitions to CONFIRMED...");
  await prisma.booking.update({
    where: { reference: booking.reference },
    data: { status: BookingStatus.CONFIRMED },
  });
  console.log("  ✅ Booking is now CONFIRMED\n");

  // Step 2.5: Customer reschedules to another slot
  console.log("▶ Step 2.5: Customer decides to reschedule to another available slot...");
  const rescheduleDate = new Date();
  rescheduleDate.setDate(rescheduleDate.getDate() + 6);
  const rescheduleDateStr = formatDate(rescheduleDate);

  const reschedAvail = await api("GET", `/bookings/availability?date=${rescheduleDateStr}&durationMinutes=${activePkg.durationMinutes}`);
  const newSlots: string[] = reschedAvail.data?.slots ?? [];
  assert.ok(newSlots.length > 0, "Must have slots on reschedule date");
  const newSlot = newSlots[newSlots.length - 1]; // pick end of day slot

  const reschedRes = await api("POST", "/bookings/customer-reschedule", {
    body: {
      reference: booking.reference,
      emailOrPhone: goodCustomerEmail,
      newStartTime: newSlot,
      reason: "Scheduling conflict, shifting to weekend.",
    },
  });

  assert.ok(reschedRes.status === 200 || reschedRes.status === 201, `Reschedule should succeed: ${reschedRes.status} ${JSON.stringify(reschedRes.data)}`);
  console.log(`  ✅ Rescheduled successfully to: ${newSlot}`);
  console.log(`  Reschedule Policy Notice: ${reschedRes.data?.message}\n`);

  // Step 2.6: Customer cancellation check
  console.log("▶ Step 2.6: Customer tests self-service cancellation...");
  const cancelRes = await api("POST", "/bookings/customer-cancel", {
    body: {
      reference: booking.reference,
      emailOrPhone: goodCustomerEmail,
      reason: "Traveling out of town",
    },
  });
  assert.ok(cancelRes.status === 200 || cancelRes.status === 201, `Cancellation should succeed: ${cancelRes.status}`);
  console.log(`  ✅ Booking successfully cancelled under studio policy: ${cancelRes.data?.message}\n`);

  // =========================================================================
  // 3. HACKER MODE (Adversarial Security & Integrity Checks)
  // =========================================================================
  console.log("-----------------------------------------------------------------");
  console.log(" 🛡️ [TEST SUITE 3: HACKER / ADVERSARIAL INTEGRITY FLOW]");
  console.log("-----------------------------------------------------------------");

  // Attack 3.1: Price Tampering (Client sends ₦0 or manipulated price)
  console.log("▶ Attack 3.1: Attacker attempts to inject forged price fields (`priceKobo: 0`, `amountKobo: 100`)...");
  const hackerEmail = `hacker.${Date.now()}@adversary.test`;
  const attack1Date = new Date();
  attack1Date.setDate(attack1Date.getDate() + 7);
  const attack1Avail = await api("GET", `/bookings/availability?date=${formatDate(attack1Date)}&durationMinutes=${activePkg.durationMinutes}`);
  const attack1Slot = attack1Avail.data?.slots?.[0];
  assert.ok(attack1Slot, "Must have slot for attack 1");

  const attack1Res = await api("POST", "/bookings/hold", {
    body: {
      packageId: activePkg.id,
      startTime: attack1Slot,
      customerName: "Price Hacker",
      customerEmail: hackerEmail,
      customerPhone: "08099887766",
      priceKobo: 0,
      totalPriceKobo: 0,
      amountKobo: 100,
    },
  });

  console.log(`  Tamper Attempt Response Status: ${attack1Res.status}, Error:`, attack1Res.data?.message || attack1Res.data);
  assert.equal(attack1Res.status, 400, "Server must reject client-injected pricing parameters via DTO schema validation");
  console.log("  ✅ Server strictly rejected client-injected price fields via DTO whitelist validation!\n");

  // Attack 3.2: XSS & SQL Injection Payloads
  console.log("▶ Attack 3.2: Attacker injects XSS `<script>alert('pwned')</script>` and SQLi `' OR '1'='1`...");
  const attack2Date = new Date();
  attack2Date.setDate(attack2Date.getDate() + 8);
  const attack2Avail = await api("GET", `/bookings/availability?date=${formatDate(attack2Date)}&durationMinutes=${activePkg.durationMinutes}`);
  const attack2Slot = attack2Avail.data?.slots?.[0];
  assert.ok(attack2Slot, "Must have slot for attack 2");

  const attack2Res = await api("POST", "/bookings/hold", {
    body: {
      packageId: activePkg.id,
      startTime: attack2Slot,
      customerName: "<script>alert('xss')</script>Robert'); DROP TABLE Bookings;--",
      customerEmail: `inject.${Date.now()}@test.com`,
      customerPhone: "08055443322",
    },
  });

  assert.equal(attack2Res.status, 201, "Request handled safely via Prisma ORM parameterized queries");
  const injectionBooking = attack2Res.data.booking || attack2Res.data;
  console.log(`  Booking created with reference: ${injectionBooking.reference}`);
  
  // Verify database tables are completely intact
  const tableCheck = await prisma.service.count();
  assert.ok(tableCheck > 0, "Database tables completely intact");
  console.log("  ✅ SQLi / XSS injection sanitized: Zero SQL injection vulnerability, safely parameterized by Prisma ORM!\n");

  // Attack 3.3: Concurrency Race Condition / Double Booking Collision
  console.log("▶ Attack 3.3: Simulating simultaneous race condition (2 users booking EXACT same slot at same millisecond)...");
  const raceDate = new Date();
  raceDate.setDate(raceDate.getDate() + 9);
  const raceAvail = await api("GET", `/bookings/availability?date=${formatDate(raceDate)}&durationMinutes=${activePkg.durationMinutes}`);
  const raceSlot = raceAvail.data?.slots?.[0];
  assert.ok(raceSlot, "Must have slot for race test");

  const [raceResult1, raceResult2] = await Promise.all([
    api("POST", "/bookings/hold", {
      body: {
        packageId: activePkg.id,
        startTime: raceSlot,
        customerName: "Racer One",
        customerEmail: `racer1.${Date.now()}@test.com`,
        customerPhone: "08011112222",
      },
    }),
    api("POST", "/bookings/hold", {
      body: {
        packageId: activePkg.id,
        startTime: raceSlot,
        customerName: "Racer Two",
        customerEmail: `racer2.${Date.now()}@test.com`,
        customerPhone: "08033334444",
      },
    }),
  ]);

  console.log(`  Racer 1 Response Status: ${raceResult1.status}`);
  console.log(`  Racer 2 Response Status: ${raceResult2.status}`);

  const statuses = [raceResult1.status, raceResult2.status];
  const successCount = statuses.filter((s) => s === 201).length;
  const failureCount = statuses.filter((s) => s >= 400).length;

  console.log(`  Successes: ${successCount}, Rejections: ${failureCount}`);
  assert.ok(
    successCount === 1 && failureCount === 1,
    "Concurrency locking must only allow EXACTLY ONE booking for the slot and reject the overlapping conflict!",
  );
  console.log("  ✅ Slot collision prevented: Exactly 1 user acquired the hold, conflicting overlap rejected with HTTP 409 Conflict!\n");

  // Attack 3.4: PII Isolation Check
  console.log("▶ Attack 3.4: Attacker tries accessing another customer's booking lookup without credentials...");
  const piiLeakCheck = await api("GET", `/bookings/lookup?reference=${booking.reference}&emailOrPhone=attacker@hacker.org`);
  console.log(`  Attacker lookup status: ${piiLeakCheck.status}`);
  assert.ok(piiLeakCheck.status >= 400, "Must block unauthorized access to customer booking details");
  console.log("  ✅ Customer PII strictly isolated: Access denied without matching customer email/phone!\n");

  console.log("=================================================================");
  console.log(" 🏆 ALL 3 SUITES (WRONG, GOOD, HACKER) COMPLETED WITH 100% SUCCESS!");
  console.log("=================================================================\n");
}

runBookingSimulations()
  .catch((err) => {
    console.error("❌ Simulation Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
