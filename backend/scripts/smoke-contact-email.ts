/**
 * Smoke: contactEmail enforcement + no CRM email override on phone match.
 * Usage: npx tsx scripts/smoke-contact-email.ts
 */
import "./load-env";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const API = (process.env.API_BASE ?? "http://127.0.0.1:3001/api").replace(/\/$/, "");
const prisma = new PrismaClient();

const PHONE_A = "+2348090011001";
const EMAIL_FIRST = `smoke-first-${Date.now()}@dammy-ray.com.ng`;
const EMAIL_SECOND = `smoke-second-${Date.now()}@dammy-ray.com.ng`;

async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = { raw: text } as T;
  }
  return { status: res.status, data };
}

function nextOpenDayCandidates(): string[] {
  const days: string[] = [];
  for (let i = 3; i <= 21; i += 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function main() {
  console.log("Smoke: contact email enforcement\n");
  const createdBookingIds: string[] = [];
  let customerId: string | null = null;

  try {
    // --- 1) Hold without email must fail ---
    const pkgs = await api<{ id: string; packages: Array<{ id: string; durationMinutes: number; name: string }> }[]>(
      "GET",
      "/public/services",
    );
    assert.equal(pkgs.status, 200, `public services ${pkgs.status}`);
    const service = (pkgs.data as Array<{ packages?: Array<{ id: string; durationMinutes: number; name: string }> }>).find(
      (s) => Array.isArray(s.packages) && s.packages.length > 0,
    );
    assert.ok(service?.packages?.[0], "need an active package");
    const pkg = service.packages[0];

    let slot1 = "";
    let slot2 = "";
    for (const ymd of nextOpenDayCandidates()) {
      const avail = await api<{ slots: string[] }>(
        "GET",
        `/bookings/availability?date=${ymd}&durationMinutes=${pkg.durationMinutes}`,
      );
      if (avail.status === 200 && (avail.data.slots?.length ?? 0) >= 1) {
        slot1 = avail.data.slots[0]!;
        slot2 = avail.data.slots[1] ?? "";
        if (!slot2) {
          // try next day for second slot
          continue;
        }
        break;
      }
    }
    if (!slot2) {
      for (const ymd of nextOpenDayCandidates()) {
        const avail = await api<{ slots: string[] }>(
          "GET",
          `/bookings/availability?date=${ymd}&durationMinutes=${pkg.durationMinutes}`,
        );
        if (avail.status === 200 && avail.data.slots?.length) {
          if (!slot1) slot1 = avail.data.slots[0]!;
          else if (avail.data.slots[0] !== slot1) {
            slot2 = avail.data.slots[0]!;
            break;
          }
        }
      }
    }
    assert.ok(slot1, "need an open slot for smoke holds");
    if (!slot2) slot2 = slot1;

    const missingEmail = await api("POST", "/bookings/hold", {
      packageId: pkg.id,
      startTime: slot1,
      customerName: "Smoke Tester",
      customerPhone: PHONE_A,
      // customerEmail omitted
    });
    assert.ok(missingEmail.status >= 400, `hold without email should fail, got ${missingEmail.status}`);
    console.log("✓ Hold without email rejected");

    // --- 2) First hold saves contactEmail + creates customer ---
    const hold1 = await api<{
      bookingId: string;
      reference: string;
      status: string;
    }>("POST", "/bookings/hold", {
      packageId: pkg.id,
      startTime: slot1,
      customerName: "Smoke Tester",
      customerPhone: PHONE_A,
      customerEmail: EMAIL_FIRST,
    });
    assert.ok(hold1.status < 300, `hold1 failed ${hold1.status} ${JSON.stringify(hold1.data)}`);
    createdBookingIds.push(hold1.data.bookingId);

    const b1 = await prisma.booking.findUniqueOrThrow({
      where: { id: hold1.data.bookingId },
      include: { customer: true },
    });
    assert.equal(b1.contactEmail, EMAIL_FIRST);
    assert.equal(b1.customer.email, EMAIL_FIRST);
    assert.equal(b1.customer.phone, PHONE_A);
    customerId = b1.customerId;
    console.log(`✓ First hold saved contactEmail=${EMAIL_FIRST}`);

    // --- 3) Same phone, different email: CRM email unchanged, booking uses inputted ---
    let start2 = slot2;
    if (start2 === slot1) {
      for (const ymd of nextOpenDayCandidates()) {
        const avail2 = await api<{ slots: string[] }>(
          "GET",
          `/bookings/availability?date=${ymd}&durationMinutes=${pkg.durationMinutes}`,
        );
        const next = avail2.data.slots?.find((s) => s !== slot1);
        if (next) {
          start2 = next;
          break;
        }
      }
    }
    assert.notEqual(start2, slot1, "need a second distinct slot");

    const hold2 = await api<{ bookingId: string; reference: string }>("POST", "/bookings/hold", {
      packageId: pkg.id,
      startTime: start2,
      customerName: "Smoke Tester Updated",
      customerPhone: PHONE_A,
      customerEmail: EMAIL_SECOND,
    });
    assert.ok(hold2.status < 300, `hold2 failed ${hold2.status} ${JSON.stringify(hold2.data)}`);
    createdBookingIds.push(hold2.data.bookingId);

    const b2 = await prisma.booking.findUniqueOrThrow({
      where: { id: hold2.data.bookingId },
      include: { customer: true },
    });
    assert.equal(b2.customerId, customerId, "same phone must reuse CRM customer");
    assert.equal(b2.customer.email, EMAIL_FIRST, "CRM email must NOT be overwritten");
    assert.equal(b2.contactEmail, EMAIL_SECOND, "booking must keep inputted email");
    assert.equal(b2.customer.name, "Smoke Tester Updated", "name may refresh");
    console.log("✓ Same phone: CRM email kept; booking.contactEmail = inputted");

    // --- 4) Admin create without email rejected ---
    const desk = await api<{ email: string }>("GET", "/auth/desk-email");
    assert.equal(desk.status, 200);
    const login = await api<{ token: string }>("POST", "/auth/login", {
      email: desk.data.email,
      password: process.env.SMOKE_OWNER_PASSWORD ?? process.env.SEED_OWNER_PASSWORD ?? "changeme",
    });
    if (login.status < 300 && login.data.token) {
      let adminSlot = "";
      for (const ymd of nextOpenDayCandidates()) {
        const a = await api<{ slots: string[] }>(
          "GET",
          `/admin/availability?date=${ymd}&durationMinutes=${pkg.durationMinutes}`,
          undefined,
          login.data.token,
        );
        const free = a.data.slots?.find((s) => s !== slot1 && s !== start2);
        if (free) {
          adminSlot = free;
          break;
        }
      }
      assert.ok(adminSlot, "need admin free slot");

      const adminMissing = await api("POST", "/admin/bookings", {
        customerName: "Admin Smoke",
        customerPhone: "+2348090011002",
        packageId: pkg.id,
        startTime: adminSlot,
        source: "WALK_IN",
      }, login.data.token);
      assert.ok(
        adminMissing.status >= 400,
        `admin without email should fail, got ${adminMissing.status}`,
      );
      console.log("✓ Admin booking without email rejected");

      const adminOk = await api<{ id: string; reference: string }>(
        "POST",
        "/admin/bookings",
        {
          customerName: "Admin Smoke",
          customerPhone: "+2348090011002",
          customerEmail: `admin-smoke-${Date.now()}@dammy-ray.com.ng`,
          packageId: pkg.id,
          startTime: adminSlot,
          source: "WALK_IN",
        },
        login.data.token,
      );
      assert.ok(adminOk.status < 300, `admin create failed ${adminOk.status} ${JSON.stringify(adminOk.data)}`);
      createdBookingIds.push(adminOk.data.id);
      const ba = await prisma.booking.findUniqueOrThrow({ where: { id: adminOk.data.id } });
      assert.ok(ba.contactEmail.includes("@dammy-ray.com.ng"));
      console.log(`✓ Admin booking saved contactEmail=${ba.contactEmail}`);
    } else {
      console.log("⚠ Skipped admin checks (owner login failed — set SMOKE_OWNER_PASSWORD)");
    }

    // --- 5) notify helper preference: contactEmail wins ---
    const { bookingNotifyEmail } = await import("../src/common/booking-contact");
    assert.equal(
      bookingNotifyEmail({ contactEmail: EMAIL_SECOND, customer: { email: EMAIL_FIRST } }),
      EMAIL_SECOND,
    );
    console.log("✓ bookingNotifyEmail prefers contactEmail");

    console.log("\nSMOKE PASS — contact email rules OK");
  } finally {
    if (createdBookingIds.length) {
      await prisma.payment.deleteMany({ where: { bookingId: { in: createdBookingIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: createdBookingIds } } });
    }
    await prisma.customer.deleteMany({
      where: { phone: { in: [PHONE_A, "+2348090011002"] } },
    });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\nSMOKE FAIL", err);
  process.exit(1);
});
