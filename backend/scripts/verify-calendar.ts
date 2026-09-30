/**
 * Calendar / availability E2E against a live API + DB.
 * Creates temporary holds/bookings and cleans them up.
 *
 * Env: API_BASE, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD
 */
import "./load-env";
import assert from "node:assert/strict";
import { BookingStatus, PrismaClient } from "@prisma/client";
import {
  BOOKING_RULES,
  generateCandidateStartsForYmd,
  lagosDateTime,
  openingHoursForYmd,
  slotFits,
  toLagosHour,
  toLagosYmd,
  addLagosDays,
} from "../src/bookings/availability";
import { blockingWhere } from "../src/bookings/blocking";
import { isOverlapConstraintError } from "../src/bookings/resource-lock";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");
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
  return addLagosDays(toLagosYmd(new Date()), days);
}

async function main() {
  const createdIds: string[] = [];
  const stamp = Date.now();
  let originalWeekdayHours: string | null | undefined;

  try {
    // --- Offline rules (source of truth) ---
    assert.equal(BOOKING_RULES.slotIncrementMinutes, 30);
    assert.equal(BOOKING_RULES.bufferMinutes, 0);
    assert.equal(BOOKING_RULES.sameDayMinimumNoticeMinutes, 0);
    assert.equal(BOOKING_RULES.holdDurationMinutes, 15);
    assert.equal(BOOKING_RULES.timezone, "Africa/Lagos");

    const sunday = "2026-09-13";
    const saturday = "2026-09-12";
    assert.deepEqual(openingHoursForYmd(sunday), { startHour: 12, endHour: 18 });
    assert.deepEqual(openingHoursForYmd(saturday), { startHour: 8, endHour: 18 });
    assert.equal(toLagosHour(generateCandidateStartsForYmd(sunday)[0]!), 12);
    assert.equal(toLagosHour(generateCandidateStartsForYmd(saturday)[0]!), 8);

    const lateStart = lagosDateTime(saturday, 17, 0);
    assert.equal(slotFits(lateStart, 90, new Date("2026-09-11T10:00:00+01:00"), []), false, "90m past close");
    assert.equal(slotFits(lateStart, 60, new Date("2026-09-11T10:00:00+01:00"), []), true, "60m fits to 18:00");
    console.log("rules + duration-to-close ✓");

    // --- Live API ---
    const health = await api("GET", "/health");
    assert.ok(health.status < 300, `health ${health.status}`);

    const packages = await api<
      Array<{ id: string; name: string; packages: Array<{ id: string; durationMinutes: number; priceKobo: number }> }>
    >("GET", "/bookings/packages", { ip: "10.255.20.1" });
    assert.ok(packages.status < 300);
    const allPkgs = packages.data.flatMap((s) => s.packages.map((p) => ({ ...p, serviceId: s.id })));
    const pkg60 = allPkgs.find((p) => p.durationMinutes === 60) ?? allPkgs[0];
    const pkg90 = allPkgs.find((p) => p.durationMinutes === 90) ?? allPkgs.find((p) => p.durationMinutes >= 90);
    assert.ok(pkg60, "need a package");
    console.log(`packages: using ${pkg60.durationMinutes}m` + (pkg90 ? ` and ${pkg90.durationMinutes}m` : ""));

    // Find a weekday with slots far enough out
    let day = "";
    let slots60: string[] = [];
    for (let d = 2; d <= 14; d += 1) {
      const ymd = lagosDateOffset(d);
      if (openingHoursForYmd(ymd).startHour !== 8) continue; // prefer weekday
      const avail = await api<{ slots: string[]; durationMinutes: number; rules: typeof BOOKING_RULES }>(
        "GET",
        `/bookings/availability?date=${encodeURIComponent(ymd)}&durationMinutes=${pkg60.durationMinutes}`,
        { ip: "10.255.20.1" },
      );
      assert.ok(avail.status < 300, `avail ${avail.status}`);
      assert.equal(avail.data.durationMinutes, pkg60.durationMinutes);
      assert.equal(avail.data.rules.slotIncrementMinutes, 30);
      assert.equal(avail.data.rules.timezone, "Africa/Lagos");
      if ((avail.data.slots?.length ?? 0) >= 2) {
        day = ymd;
        slots60 = avail.data.slots;
        break;
      }
    }
    assert.ok(day && slots60.length >= 2, "need weekday with ≥2 open slots");
    console.log(`public availability source: GET /bookings/availability (${day}, ${slots60.length} slots) ✓`);

    // Sunday hours via live API (12:00–18:00 Lagos)
    let sundayYmd = "";
    for (let d = 1; d <= 14; d += 1) {
      const ymd = lagosDateOffset(d);
      if (openingHoursForYmd(ymd).startHour === 12) {
        sundayYmd = ymd;
        break;
      }
    }
    assert.ok(sundayYmd, "need an upcoming Sunday");
    const sundayAvail = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(sundayYmd)}&durationMinutes=${pkg60.durationMinutes}`,
      { ip: "10.255.20.9" },
    );
    assert.ok(sundayAvail.status < 300);
    if (sundayAvail.data.slots.length > 0) {
      assert.equal(toLagosHour(new Date(sundayAvail.data.slots[0]!)), 12, "Sunday first slot 12:00 Lagos");
      for (const iso of sundayAvail.data.slots) {
        const h = toLagosHour(new Date(iso));
        assert.ok(h >= 12 && h < 18, `Sunday slot hour ${h} in [12,18)`);
      }
    }
    console.log(`Sunday live availability (${sundayYmd}, ${sundayAvail.data.slots.length} slots) ✓`);

    // 90/120-minute occupancy vs 60-minute grid
    if (pkg90) {
      const start = slots60[0]!;
      const end90 = new Date(new Date(start).getTime() + pkg90.durationMinutes * 60_000);
      const avail90 = await api<{ slots: string[] }>(
        "GET",
        `/bookings/availability?date=${encodeURIComponent(day)}&durationMinutes=${pkg90.durationMinutes}`,
        { ip: "10.255.20.1" },
      );
      assert.ok(avail90.status < 300);
      // Every returned 90m slot must fit before close
      for (const iso of avail90.data.slots) {
        assert.ok(
          slotFits(new Date(iso), pkg90.durationMinutes, new Date("2000-01-01T00:00:00Z"), [], {
            requireSameDayNotice: false,
          }),
          `90m slot ${iso} must fit hours`,
        );
      }
      // Holding a 90m package should block overlapping 60m starts
      const hold90 = await api<{ bookingId: string; reference: string }>("POST", "/bookings/hold", {
        ip: "10.255.20.2",
        body: {
          packageId: pkg90.id,
          startTime: start,
          customerName: `Cal90 ${stamp}`,
          customerPhone: `0806${String(stamp).slice(-7)}`,
          customerEmail: `cal90-${stamp}@example.com`,
        },
      });
      if (hold90.status < 300) {
        createdIds.push(hold90.data.bookingId);
        const after = await api<{ slots: string[] }>(
          "GET",
          `/bookings/availability?date=${encodeURIComponent(day)}&durationMinutes=${pkg60.durationMinutes}`,
          { ip: "10.255.20.1" },
        );
        const blocked = after.data.slots.includes(start);
        assert.equal(blocked, false, "60m start at same time blocked by 90m hold");
        // Slot 30m later should also be blocked if it overlaps 90m window
        const plus30 = new Date(new Date(start).getTime() + 30 * 60_000).toISOString();
        if (slots60.includes(plus30)) {
          assert.equal(after.data.slots.includes(plus30), false, "overlapping +30m blocked by 90m hold");
        }
        void end90;
        console.log(`${pkg90.durationMinutes}m package occupies overlapping 60m slots ✓`);
        await prisma.booking.update({
          where: { id: hold90.data.bookingId },
          data: { status: BookingStatus.CANCELLED, holdExpiresAt: null },
        });
      } else {
        console.log(`skip 90m hold (${hold90.status}) — slot may not fit duration`);
      }
    } else {
      console.log("no ≥90m package in DB — duration-span overlap checked via unit slotFits only");
    }

    // Refresh slots after cleanup
    const refresh = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(day)}&durationMinutes=${pkg60.durationMinutes}`,
      { ip: "10.255.20.1" },
    );
    slots60 = refresh.data.slots;
    assert.ok(slots60.length >= 2);

    // Double-booking: concurrent holds same slot
    const target = slots60[0]!;
    const [a, b] = await Promise.all([
      api<{ bookingId: string }>("POST", "/bookings/hold", {
        ip: "10.255.20.3",
        body: {
          packageId: pkg60.id,
          startTime: target,
          customerName: `CalA ${stamp}`,
          customerPhone: `0807${String(stamp).slice(-7)}`,
          customerEmail: `cala-${stamp}@example.com`,
        },
      }),
      api<{ bookingId: string }>("POST", "/bookings/hold", {
        ip: "10.255.20.4",
        body: {
          packageId: pkg60.id,
          startTime: target,
          customerName: `CalB ${stamp}`,
          customerPhone: `0808${String(stamp).slice(-7)}`,
          customerEmail: `calb-${stamp}@example.com`,
        },
      }),
    ]);
    const statuses = [a.status, b.status].sort();
    const winners = [a, b].filter((r) => r.status < 300);
    const losers = [a, b].filter((r) => r.status === 409);
    assert.equal(winners.length, 1, `exactly one winner got ${statuses}`);
    assert.equal(losers.length, 1, "loser is 409");
    createdIds.push(winners[0]!.data.bookingId);
    console.log("double-booking concurrent holds → one wins, one 409 ✓");

    // Hold blocks public availability
    const blockedAvail = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(day)}&durationMinutes=${pkg60.durationMinutes}`,
      { ip: "10.255.20.1" },
    );
    assert.equal(blockedAvail.data.slots.includes(target), false, "held slot absent from availability");
    console.log("active hold blocks availability ✓");

    // Admin range sees the hold on correct Lagos day
    const desk = await api<{ email: string }>("GET", "/auth/desk-email", { ip: "10.255.20.4" });
    assert.equal(desk.status, 200, `desk-email ${desk.status}`);
    const login = await api<{ token: string }>("POST", "/auth/login", {
      body: { email: desk.data.email, password: ownerPassword },
      ip: "10.255.20.5",
    });
    assert.ok(login.status < 300 && login.data.token, `login ${login.status}`);
    const range = await api<Array<{ id: string; startTime: string; status: string }>>(
      "GET",
      `/admin/bookings/range?from=${encodeURIComponent(day)}&to=${encodeURIComponent(day)}`,
      { token: login.data.token },
    );
    assert.ok(range.status < 300, `range ${range.status}`);
    const seen = range.data.find((r) => r.id === winners[0]!.data.bookingId);
    assert.ok(seen, "admin calendar range includes hold");
    assert.equal(toLagosYmd(new Date(seen!.startTime)), day);
    console.log("admin range places booking on correct Lagos date ✓");

    // Same day: no notice period, but nothing that has already started (public and admin agree)
    const today = toLagosYmd(new Date());
    const publicToday = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(today)}&durationMinutes=${pkg60.durationMinutes}`,
      { ip: "10.255.20.1" },
    );
    const adminToday = await api<{ slots: string[] }>(
      "GET",
      `/admin/availability?date=${encodeURIComponent(today)}&durationMinutes=${pkg60.durationMinutes}`,
      { token: login.data.token },
    );
    assert.ok(publicToday.status < 300 && adminToday.status < 300);
    assert.deepEqual(adminToday.data.slots, publicToday.data.slots, "no same-day notice: admin and public match");
    const checkedAt = Date.now();
    for (const iso of publicToday.data.slots) {
      assert.ok(new Date(iso).getTime() > checkedAt - 5_000, `today slot ${iso} already started`);
    }
    console.log(`same-day slots start from the next unstarted time (${publicToday.data.slots[0] ?? "none left"}) ✓`);

    // Past dates offer nothing and cannot be held
    const pastDay = lagosDateOffset(-3);
    const pastPublic = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(pastDay)}&durationMinutes=${pkg60.durationMinutes}`,
      { ip: "10.255.20.1" },
    );
    const pastAdmin = await api<{ slots: string[] }>(
      "GET",
      `/admin/availability?date=${encodeURIComponent(pastDay)}&durationMinutes=${pkg60.durationMinutes}`,
      { token: login.data.token },
    );
    assert.equal(pastPublic.data.slots.length, 0, "past date public availability empty");
    assert.equal(pastAdmin.data.slots.length, 0, "past date admin availability empty");
    const pastHold = await api("POST", "/bookings/hold", {
      ip: "10.255.20.6",
      body: {
        packageId: pkg60.id,
        startTime: lagosDateTime(pastDay, 13, 0).toISOString(),
        customerName: `CalPast ${stamp}`,
        customerPhone: `0805${String(stamp).slice(-7)}`,
        customerEmail: `calpast-${stamp}@example.com`,
      },
    });
    assert.equal(pastHold.status, 409, `past hold must be refused, got ${pastHold.status}`);
    console.log("past dates: no slots, hold refused ✓");

    // An expired hold the cron has not cancelled yet must not block a new booking
    // (the DB exclusion constraint still counts it until it is cancelled).
    const holdId = winners[0]!.data.bookingId;
    await prisma.booking.update({
      where: { id: holdId },
      data: { holdExpiresAt: new Date(Date.now() - 60_000), status: BookingStatus.TEMPORARY_HOLD },
    });
    const afterExpireLogic = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(day)}&durationMinutes=${pkg60.durationMinutes}`,
      { ip: "10.255.20.1" },
    );
    assert.equal(afterExpireLogic.data.slots.includes(target), true, "expired hold no longer blocks");
    const rehold = await api<{ bookingId: string }>("POST", "/bookings/hold", {
      ip: "10.255.20.7",
      body: {
        packageId: pkg60.id,
        startTime: target,
        customerName: `CalRe ${stamp}`,
        customerPhone: `0804${String(stamp).slice(-7)}`,
        customerEmail: `calre-${stamp}@example.com`,
      },
    });
    assert.ok(rehold.status < 300, `re-hold over stale expired hold ${rehold.status} ${JSON.stringify(rehold.data)}`);
    createdIds.push(rehold.data.bookingId);
    const stale = await prisma.booking.findUnique({ where: { id: holdId }, select: { status: true } });
    assert.equal(stale?.status, BookingStatus.CANCELLED, "stale expired hold released inside the booking transaction");
    await prisma.booking.update({
      where: { id: rehold.data.bookingId },
      data: { status: BookingStatus.CANCELLED, holdExpiresAt: null },
    });
    console.log("expired hold releases slot, even before the cron runs ✓");

    // Confirmed booking blocks; cancel releases
    const slot2 = afterExpireLogic.data.slots.find((s) => s !== target) ?? afterExpireLogic.data.slots[0]!;
    const pending = await api<{ id: string }>("POST", "/admin/bookings", {
      token: login.data.token,
      body: {
        packageId: pkg60.id,
        startTime: slot2,
        customerName: `CalWalk ${stamp}`,
        customerPhone: `0809${String(stamp).slice(-7)}`,
        customerEmail: `calwalk-${stamp}@example.com`,
        source: "WALK_IN",
      },
    });
    assert.ok(pending.status < 300, `admin create ${pending.status} ${JSON.stringify(pending.data)}`);
    createdIds.push(pending.data.id);
    const paid = await api("POST", `/admin/bookings/${pending.data.id}/payment`, {
      token: login.data.token,
      body: { note: "calendar verify" },
    });
    assert.ok(paid.status < 300, `mark paid ${paid.status}`);
    const afterPaid = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(day)}&durationMinutes=${pkg60.durationMinutes}`,
      { ip: "10.255.20.1" },
    );
    assert.equal(afterPaid.data.slots.includes(slot2), false, "confirmed paid booking blocks slot");
    console.log("payment confirmation keeps slot occupied ✓");

    // Future sessions cannot be marked completed / no-show (that would reopen the slot)
    for (const status of ["COMPLETED", "NO_SHOW"] as const) {
      const early = await api("PATCH", `/admin/bookings/${pending.data.id}/status`, {
        token: login.data.token,
        body: { status },
      });
      assert.equal(early.status, 400, `${status} before start must be refused, got ${early.status}`);
    }
    console.log("future booking cannot be marked completed / no-show ✓");

    // DB backstop: an overlapping write that skips the app lock is rejected by Postgres
    const occupying = await prisma.booking.findUniqueOrThrow({ where: { id: pending.data.id } });
    await assert.rejects(
      prisma.booking.create({
        data: {
          customerId: occupying.customerId,
          packageId: occupying.packageId,
          resourceId: occupying.resourceId,
          startTime: new Date(occupying.startTime.getTime() + 30 * 60_000),
          endTime: new Date(occupying.endTime.getTime() + 30 * 60_000),
          status: BookingStatus.PENDING,
          source: "ADMIN",
        },
      }),
      (err: unknown) => isOverlapConstraintError(err),
      "overlapping insert without the lock must hit Booking_no_overlap",
    );
    console.log("Booking_no_overlap constraint rejects unlocked overlapping insert ✓");

    // Reschedule moves block
    const slot3 = afterPaid.data.slots[0];
    assert.ok(slot3, "need free slot to reschedule into");
    const moved = await api<{ id: string; startTime: string }>(
      "POST",
      `/admin/bookings/${pending.data.id}/reschedule`,
      { token: login.data.token, body: { startTime: slot3 } },
    );
    assert.ok(moved.status < 300, `reschedule ${moved.status} ${JSON.stringify(moved.data)}`);
    const afterMove = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(day)}&durationMinutes=${pkg60.durationMinutes}`,
      { ip: "10.255.20.1" },
    );
    assert.equal(afterMove.data.slots.includes(slot2), true, "old slot freed after reschedule");
    assert.equal(afterMove.data.slots.includes(slot3!), false, "new slot blocked after reschedule");
    console.log("reschedule moves occupancy ✓");

    await api("PATCH", `/admin/bookings/${pending.data.id}/status`, {
      token: login.data.token,
      body: { status: "CANCELLED" },
    });
    const afterCancel = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(day)}&durationMinutes=${pkg60.durationMinutes}`,
      { ip: "10.255.20.1" },
    );
    assert.equal(afterCancel.data.slots.includes(slot3!), true, "cancelled booking frees slot");
    console.log("cancelled booking frees slot ✓");

    // DB blockingWhere excludes CANCELLED / expired holds
    const resource = await prisma.studioResource.findFirst({ where: { isActive: true } });
    assert.ok(resource);
    const blocking = await prisma.booking.findMany({
      where: { resourceId: resource!.id, ...blockingWhere() },
      select: { id: true, status: true },
    });
    assert.ok(!blocking.some((b) => b.status === "CANCELLED"));
    console.log("blockingWhere excludes cancelled ✓");

    // Payment confirmation honours widened CMS hours (needs PAYMENTS_MOCK=true on the API)
    const hoursRow = await prisma.businessSettings.findUnique({ where: { key: "site.hours.weekday" } });
    originalWeekdayHours = hoursRow?.value ?? null;
    await prisma.businessSettings.upsert({
      where: { key: "site.hours.weekday" },
      update: { value: "8:00 AM – 8:00 PM" },
      create: { key: "site.hours.weekday", value: "8:00 AM – 8:00 PM" },
    });
    const evening = lagosDateTime(day, 18, 30).toISOString();
    const eveningHold = await api<{ bookingId: string; reference: string }>("POST", "/bookings/hold", {
      ip: "10.255.20.8",
      body: {
        packageId: pkg60.id,
        startTime: evening,
        customerName: `CalCms ${stamp}`,
        customerPhone: `0803${String(stamp).slice(-7)}`,
        customerEmail: `calcms-${stamp}@example.com`,
      },
    });
    assert.ok(eveningHold.status < 300, `hold in widened CMS hours ${eveningHold.status} ${JSON.stringify(eveningHold.data)}`);
    createdIds.push(eveningHold.data.bookingId);
    const checkout = await api<{ provider: string; reference: string }>(
      "POST",
      `/bookings/${eveningHold.data.bookingId}/checkout`,
      {
        ip: "10.255.20.8",
        body: {
          reference: eveningHold.data.reference,
          returnUrl: "http://localhost:5173/book/confirmation",
          cancelUrl: "http://localhost:5173/book",
        },
      },
    );
    assert.ok(checkout.status < 300, `checkout ${checkout.status} ${JSON.stringify(checkout.data)}`);
    assert.equal(checkout.data.provider, "mock", "CMS-hours payment check needs PAYMENTS_MOCK=true");
    const completed = await api<{ status: string }>("POST", "/payments/mock/complete", {
      body: { reference: checkout.data.reference },
    });
    assert.ok(completed.status < 300, `mock complete ${completed.status} ${JSON.stringify(completed.data)}`);
    assert.equal(completed.data.status, "CONFIRMED", "paid booking inside widened CMS hours is confirmed, not PAID_UNPLACED");
    console.log("payment confirmation honours CMS opening hours ✓");

    console.log("\nCALENDAR VERIFICATION PASS");
  } finally {
    if (originalWeekdayHours !== undefined) {
      if (originalWeekdayHours === null) {
        await prisma.businessSettings.deleteMany({ where: { key: "site.hours.weekday" } });
      } else {
        await prisma.businessSettings.update({
          where: { key: "site.hours.weekday" },
          data: { value: originalWeekdayHours },
        });
      }
    }
    for (const id of createdIds) {
      try {
        await prisma.payment.deleteMany({ where: { bookingId: id } });
        await prisma.booking.delete({ where: { id } });
      } catch {
        try {
          await prisma.booking.update({
            where: { id },
            data: { status: BookingStatus.CANCELLED, holdExpiresAt: null },
          });
        } catch {
          /* ignore */
        }
      }
    }
    await prisma.$disconnect();
  }
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
