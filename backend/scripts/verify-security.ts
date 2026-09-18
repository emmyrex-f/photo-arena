/**
 * Security remediation checks against helpers + a running API.
 *
 * Env:
 *   PAYMENTS_MOCK=true on the API (non-production)
 *   TRUST_PROXY=true so tests can isolate IPs via X-Forwarded-For
 */
import "./load-env";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { assertProductionPaymentConfig, isPaymentsMockEnabled } from "../src/common/payments-mock";
import { HOLD_IP_LIMIT, LOGIN_FAIL_LIMIT, MemoryRateLimiter, RATE_WINDOW_MS } from "../src/common/rate-limit";
import { assertCheckoutRedirectUrl, bachsHostedRedirectUrl } from "../src/common/site-origins";
import { parseMediaKind } from "../src/common/upload-path";
import { signBachsWebhookForTest } from "../src/payments/bachs-webhook";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");
const WEBHOOK_SECRET =
  process.env.BACHS_WEBHOOK_SECRET?.trim() || "whsec_local_photo_arena_dev";

type Json = Record<string, unknown>;

async function api<T = Json>(
  method: string,
  path: string,
  opts?: { body?: unknown; token?: string; ip?: string; form?: FormData },
): Promise<{ status: number; data: T; headers: Headers }> {
  const headers: Record<string, string> = {};
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts?.ip) headers["X-Forwarded-For"] = opts.ip;
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: opts?.form ? opts.form : opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await response.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = { raw: text } as T;
  }
  return { status: response.status, data, headers: response.headers };
}

function lagosDateOffset(days: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + days * 86_400_000));
}

async function firstPackageAndSlots(count: number, ip: string) {
  const packages = await api<
    Array<{ id: string; packages: Array<{ id: string; durationMinutes: number }> }>
  >("GET", "/bookings/packages", { ip });
  assert.ok(packages.status < 300, `packages ${packages.status}`);
  const pkg = packages.data[0]?.packages?.[0];
  assert.ok(pkg, "need a seeded package");
  const slots: string[] = [];
  for (let day = 1; day <= 21 && slots.length < count; day += 1) {
    const date = lagosDateOffset(day);
    const avail = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(date)}&durationMinutes=${pkg.durationMinutes}`,
      { ip },
    );
    for (const slot of avail.data.slots ?? []) {
      if (!slots.includes(slot)) slots.push(slot);
      if (slots.length >= count) break;
    }
  }
  assert.ok(slots.length >= count, `need ${count} open slots, got ${slots.length}`);
  return { pkg, slots };
}

async function postWebhook(opts: {
  id: string;
  type: string;
  reference: string;
  checkoutId: string;
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
      status: opts.type === "collection.succeeded" ? "SUCCEEDED" : "FAILED",
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
  return { status: response.status, data: (await response.json()) as { received?: boolean; duplicate?: boolean } };
}

function unitTests() {
  const prev = { ...process.env };
  try {
    process.env.NODE_ENV = "production";
    delete process.env.BACHS_API_KEY;
    process.env.PAYMENTS_MOCK = "false";
    assert.throws(() => assertProductionPaymentConfig(), /BACHS_API_KEY/);
    process.env.PAYMENTS_MOCK = "true";
    process.env.BACHS_API_KEY = "sk_live_placeholder";
    assert.throws(() => assertProductionPaymentConfig(), /PAYMENTS_MOCK/);
    process.env.PAYMENTS_MOCK = "false";
    process.env.BACHS_API_KEY = "sk_live_placeholder";
    assert.doesNotThrow(() => assertProductionPaymentConfig());
    console.log("3. Production boot without Bachs key → fail ✓");
  } finally {
    process.env.NODE_ENV = prev.NODE_ENV;
    process.env.PAYMENTS_MOCK = prev.PAYMENTS_MOCK;
    process.env.BACHS_API_KEY = prev.BACHS_API_KEY;
  }

  process.env.PAYMENTS_MOCK = "false";
  process.env.NODE_ENV = "development";
  assert.equal(isPaymentsMockEnabled(), false);

  const limiter = new MemoryRateLimiter();
  for (let i = 0; i < LOGIN_FAIL_LIMIT; i += 1) limiter.record("x", RATE_WINDOW_MS);
  assert.equal(limiter.count("x", RATE_WINDOW_MS), LOGIN_FAIL_LIMIT);
  assert.equal(limiter.hit("ip", HOLD_IP_LIMIT, RATE_WINDOW_MS), true);

    process.env.NODE_ENV = "production";
    process.env.PUBLIC_SITE_ORIGINS = "https://photoarenang.com";
    assert.throws(
      () => assertCheckoutRedirectUrl("http://localhost:5173/book/confirmation", "return"),
      /https|not allowed/,
    );
    process.env.NODE_ENV = "development";
    process.env.PUBLIC_SITE_ORIGINS = "http://localhost:5173";
  assert.doesNotThrow(() =>
    assertCheckoutRedirectUrl("http://localhost:5173/book/confirmation", "return"),
  );
  assert.throws(
    () => assertCheckoutRedirectUrl("https://evil.test/book/confirmation", "return"),
    /not allowed/,
  );
  assert.equal(
    bachsHostedRedirectUrl("http://localhost:5173/book/confirmation"),
    undefined,
    "loopback success_url is omitted for Bachs",
  );
  assert.equal(
    bachsHostedRedirectUrl("http://127.0.0.1:5173/book?cancelled=1"),
    undefined,
    "loopback cancel_url is omitted for Bachs",
  );
  assert.equal(
    bachsHostedRedirectUrl("https://photoarenang.com/book/confirmation"),
    "https://photoarenang.com/book/confirmation",
    "public https success_url is forwarded to Bachs",
  );
  assert.throws(() => parseMediaKind("../gallery"), /Invalid upload kind/);
  console.log("Unit helpers ✓");
}

async function main() {
  console.log(`Security verify → ${API_BASE}`);
  unitTests();

  const prisma = new PrismaClient();
  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? "owner@photoarenang.com").trim().toLowerCase();
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme";

  try {
    const mockOff = await api("POST", "/payments/mock/complete", {
      body: { reference: "PA-DOES-NOT-EXIST" },
      ip: "10.255.1.1",
    });
    if (mockOff.status === 403) {
      console.log("4. PAYMENTS_MOCK=false → mock complete 403 ✓");
    } else if (mockOff.status === 404 || mockOff.status === 200) {
      console.log("4. PAYMENTS_MOCK enabled on API (expected for local) — mock complete not 403");
    } else {
      assert.ok(
        mockOff.status === 403 || mockOff.status === 404,
        `mock complete unexpected ${mockOff.status}`,
      );
    }

    const { pkg, slots } = await firstPackageAndSlots(8, "10.255.1.2");

    const stamp = String(Date.now()).slice(-6);
    const holdBody = (phone: string, slot: string, name: string) => ({
      packageId: pkg.id,
      startTime: slot,
      customerName: name,
      customerPhone: phone,
      customerEmail: `${name.replace(/\s+/g, "-").toLowerCase()}-${stamp}@example.com`,
    });

    const [a, b] = await Promise.all([
      api("POST", "/bookings/hold", {
        body: holdBody(`0801${stamp}001`, slots[0]!, "Concurrent A"),
        ip: "10.255.1.10",
      }),
      api("POST", "/bookings/hold", {
        body: holdBody(`0801${stamp}002`, slots[0]!, "Concurrent B"),
        ip: "10.255.1.11",
      }),
    ]);
    const statuses = [a.status, b.status].sort();
    assert.equal(statuses.filter((s) => s === 201 || s === 200).length, 1, "exactly one concurrent hold");
    assert.equal(statuses.filter((s) => s === 409).length, 1, "loser is 409");
    console.log("5. Two simultaneous holds → one success ✓");

    const adj1 = await api<{ bookingId: string }>("POST", "/bookings/hold", {
      body: holdBody(`0801${stamp}003`, slots[1]!, "Adjacent One"),
      ip: "10.255.1.12",
    });
    const adj2 = await api<{ bookingId: string }>("POST", "/bookings/hold", {
      body: holdBody(`0801${stamp}004`, slots[2]!, "Adjacent Two"),
      ip: "10.255.1.13",
    });
    assert.ok(adj1.status < 300 && adj2.status < 300, "adjacent holds");
    console.log("6. Adjacent valid slots → both succeed ✓");

    const phoneCap = `0801${stamp}999`;
    const capIp = "10.255.1.20";
    const capStatuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await api("POST", "/bookings/hold", {
        body: holdBody(phoneCap, slots[3 + i]!, `Cap ${i}`),
        ip: capIp,
      });
      capStatuses.push(res.status);
    }
    assert.ok(capStatuses.slice(0, 3).every((s) => s < 300), `first three holds ${capStatuses}`);
    assert.equal(capStatuses[3], 409, `fourth hold ${capStatuses[3]}`);
    console.log("7. Four active holds from same phone → blocked ✓");

    const floodIp = "10.255.1.30";
    let saw429 = false;
    for (let i = 0; i < HOLD_IP_LIMIT + 1; i += 1) {
      const res = await api("POST", "/bookings/hold", {
        body: holdBody(`0801${stamp}${String(1000 + i).slice(-3)}`, slots[0]!, `Flood ${i}`),
        ip: floodIp,
      });
      if (res.status === 429) saw429 = true;
    }
    assert.equal(saw429, true, "IP hold flood should 429");
    console.log("8. Repeated requests from same IP → 429 ✓");

    const loginIp = `10.255.2.${Number(stamp.slice(-2)) || 1}`;
    const failEmail = `brute-force-nobody-${stamp}@example.com`;
    const failStatuses: number[] = [];
    for (let i = 0; i < LOGIN_FAIL_LIMIT + 1; i += 1) {
      const res = await api("POST", "/auth/login", {
        body: { email: failEmail, password: "wrong-password-xx" },
        ip: loginIp,
      });
      failStatuses.push(res.status);
    }
    assert.ok(failStatuses.slice(0, LOGIN_FAIL_LIMIT).every((s) => s === 401));
    assert.equal(failStatuses[LOGIN_FAIL_LIMIT], 429);
    console.log("9. Five failed logins → sixth blocked ✓");

    const login = await api<{ token: string; user: { id: string; role: string } }>("POST", "/auth/login", {
      body: { email: ownerEmail, password: ownerPassword },
      ip: "10.255.1.41",
    });
    assert.ok(login.status < 300, `valid login ${login.status}`);
    assert.ok(login.data.token);
    console.log("10. Valid login still succeeds ✓");
    const ownerToken = login.data.token;

    const staffEmail = `staff-sec-${Date.now()}@example.com`;
    const staffPass = "staffpass1";
    const created = await api<{ id: string }>("POST", "/admin/users", {
      token: ownerToken,
      ip: "10.255.1.42",
      body: { email: staffEmail, name: "Sec Staff", role: "ADMIN", password: staffPass },
    });
    assert.ok(created.status < 300, `create user ${created.status} ${JSON.stringify(created.data)}`);

    const staffLogin = await api<{ token: string; user: { id: string } }>("POST", "/auth/login", {
      body: { email: staffEmail, password: staffPass },
      ip: "10.255.1.43",
    });
    assert.ok(staffLogin.status < 300, `staff login ${staffLogin.status} ${JSON.stringify(staffLogin.data)}`);
    const staffToken = staffLogin.data.token;
    const staffId = created.data.id;

    await api("PATCH", `/admin/users/${staffId}`, {
      token: ownerToken,
      ip: "10.255.1.42",
      body: { isActive: false },
    });
    const dead = await api("GET", "/admin/dashboard", { token: staffToken, ip: "10.255.1.43" });
    assert.equal(dead.status, 401);
    console.log("11. Deactivated user old token → 401 ✓");

    const adminEmail = `admin-sec-${Date.now()}@example.com`;
    const adminPass = "adminpass1";
    const adminUser = await api<{ id: string }>("POST", "/admin/users", {
      token: ownerToken,
      ip: "10.255.1.42",
      body: { email: adminEmail, name: "Sec Admin", role: "ADMIN", password: adminPass },
    });
    assert.ok(adminUser.status < 300, `admin user ${adminUser.status}`);
    const adminLogin = await api<{ token: string; user: { id: string } }>("POST", "/auth/login", {
      body: { email: adminEmail, password: adminPass },
      ip: "10.255.1.44",
    });
    assert.ok(adminLogin.status < 300, `admin login ${adminLogin.status}`);
    const adminToken = adminLogin.data.token;
    await api("PATCH", `/admin/users/${adminUser.data.id}`, {
      token: ownerToken,
      ip: "10.255.1.42",
      body: { role: "STAFF" },
    });
    const demoted = await api("POST", "/admin/users", {
      token: adminToken,
      ip: "10.255.1.44",
      body: { email: "nope@example.com", name: "X", role: "STAFF", password: "password1" },
    });
    assert.ok(demoted.status === 401 || demoted.status === 403, `demoted ${demoted.status}`);
    console.log("12. Demoted user cannot access previous role privileges ✓");

    const pwUserEmail = `pw-sec-${Date.now()}@example.com`;
    const pwUser = await api<{ id: string }>("POST", "/admin/users", {
      token: ownerToken,
      ip: "10.255.1.42",
      body: { email: pwUserEmail, name: "Pw User", role: "ADMIN", password: "oldpass12" },
    });
    const pwLogin = await api<{ token: string }>("POST", "/auth/login", {
      body: { email: pwUserEmail, password: "oldpass12" },
      ip: "10.255.1.45",
    });
    assert.ok(pwLogin.status < 300, `pw login ${pwLogin.status}`);
    const oldTok = pwLogin.data.token;
    const changed = await api("POST", "/auth/change-password", {
      token: oldTok,
      ip: "10.255.1.45",
      body: { currentPassword: "oldpass12", newPassword: "newpass12" },
    });
    assert.ok(changed.status < 300, `change password ${changed.status}`);
    const stale = await api("GET", "/auth/me", { token: oldTok, ip: "10.255.1.45" });
    assert.equal(stale.status, 401);
    console.log("13. Password change invalidates old token ✓");

    const svg = new Blob([`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`], {
      type: "image/svg+xml",
    });
    const svgForm = new FormData();
    svgForm.append("files", svg, "xss.svg");
    svgForm.append("kind", "gallery");
    const svgRes = await fetch(`${API_BASE}/admin/gallery/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}`, "X-Forwarded-For": "10.255.1.50" },
      body: svgForm,
    });
    assert.ok(svgRes.status === 400 || svgRes.status === 413, `svg ${svgRes.status}`);
    console.log("14. SVG upload → rejected ✓");

    const jpeg = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 12, g: 24, b: 36 } },
    })
      .jpeg()
      .toBuffer();
    const jpegForm = new FormData();
    jpegForm.append("files", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "ok.jpg");
    jpegForm.append("kind", "gallery");
    const jpegRes = await fetch(`${API_BASE}/admin/gallery/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}`, "X-Forwarded-For": "10.255.1.51" },
      body: jpegForm,
    });
    const jpegJson = (await jpegRes.json()) as Array<{ url: string }>;
    assert.ok(jpegRes.ok, `jpeg ${jpegRes.status} ${JSON.stringify(jpegJson)}`);
    assert.ok(jpegJson[0]?.url?.endsWith(".webp"), jpegJson[0]?.url);
    console.log("15. JPEG/PNG upload → stored as WebP ✓");

    const travForm = new FormData();
    travForm.append("files", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "ok.jpg");
    travForm.append("kind", "../../../tmp");
    const trav = await fetch(`${API_BASE}/admin/gallery/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}`, "X-Forwarded-For": "10.255.1.52" },
      body: travForm,
    });
    assert.equal(trav.status, 400);
    console.log("16. Path traversal kind → rejected ✓");

    const co = await firstPackageAndSlots(2, "10.255.1.60");
    const hold = await api<{ bookingId: string; reference: string }>("POST", "/bookings/hold", {
      body: holdBody("08013330001", co.slots[0]!, "Checkout Url"),
      ip: "10.255.1.60",
    });
    assert.ok(hold.status < 300, `checkout hold ${hold.status} ${JSON.stringify(hold.data)}`);
    const evil = await api("POST", `/bookings/${hold.data.bookingId}/checkout`, {
      ip: "10.255.1.60",
      body: {
        reference: hold.data.reference,
        returnUrl: "https://evil.test/book/confirmation",
        cancelUrl: "http://localhost:5173/book?cancelled=1",
      },
    });
    assert.equal(evil.status, 400);
    console.log("17. Checkout with evil returnUrl → rejected ✓");

    const wrongRef = await api("POST", `/bookings/${hold.data.bookingId}/checkout`, {
      ip: "10.255.1.60",
      body: {
        reference: "PA-NOT-THE-ONE",
        returnUrl: "http://localhost:5173/book/confirmation",
        cancelUrl: "http://localhost:5173/book?cancelled=1",
      },
    });
    assert.equal(wrongRef.status, 400);
    console.log("18. Wrong booking reference → rejected ✓");

    const goodCo = await api<{ reference: string; provider: string }>(
      "POST",
      `/bookings/${hold.data.bookingId}/checkout`,
      {
        ip: "10.255.1.60",
        body: {
          reference: hold.data.reference,
          returnUrl: "http://localhost:5173/book/confirmation",
          cancelUrl: "http://localhost:5173/book?cancelled=1",
        },
      },
    );
    assert.ok(goodCo.status < 300, `good checkout ${goodCo.status} ${JSON.stringify(goodCo.data)}`);
    console.log("19. Matching reference + valid origin → succeeds ✓");

    const h6a = await api<{ bookingId: string; reference: string }>("POST", "/bookings/hold", {
      body: holdBody("08014440001", co.slots[1]!, "Late Free"),
      ip: "10.255.1.70",
    });
    assert.ok(h6a.status < 300, JSON.stringify(h6a.data));
    await api("POST", `/bookings/${h6a.data.bookingId}/checkout`, {
      ip: "10.255.1.70",
      body: {
        reference: h6a.data.reference,
        returnUrl: "http://localhost:5173/book/confirmation",
        cancelUrl: "http://localhost:5173/book?cancelled=1",
      },
    });
    await prisma.booking.update({
      where: { id: h6a.data.bookingId },
      data: { holdExpiresAt: new Date(Date.now() - 60_000), status: "TEMPORARY_HOLD" },
    });
    const hookA = await postWebhook({
      id: `evt_h6a_${h6a.data.reference}`,
      type: "collection.succeeded",
      reference: h6a.data.reference,
      checkoutId: `mock_${h6a.data.reference}`,
    });
    assert.ok(hookA.status < 300);
    const stA = await api<{ status: string; payment: { status: string } }>(
      "GET",
      `/bookings/${h6a.data.bookingId}/status?reference=${encodeURIComponent(h6a.data.reference)}`,
      { ip: "10.255.1.70" },
    );
    assert.equal(stA.data.status, "CONFIRMED");
    assert.equal(stA.data.payment.status, "SUCCESS");
    console.log("20. Expired hold + free slot + payment → CONFIRMED ✓");

    const h6bSlot = (await firstPackageAndSlots(3, "10.255.1.71")).slots;
    const victim = await api<{ bookingId: string; reference: string }>("POST", "/bookings/hold", {
      body: holdBody("08015550001", h6bSlot[0]!, "Late Taken"),
      ip: "10.255.1.71",
    });
    await api("POST", `/bookings/${victim.data.bookingId}/checkout`, {
      ip: "10.255.1.71",
      body: {
        reference: victim.data.reference,
        returnUrl: "http://localhost:5173/book/confirmation",
        cancelUrl: "http://localhost:5173/book?cancelled=1",
      },
    });
    await prisma.booking.update({
      where: { id: victim.data.bookingId },
      data: { holdExpiresAt: new Date(Date.now() - 60_000), status: "CANCELLED" },
    });
    const taker = await api<{ bookingId: string; reference: string }>("POST", "/bookings/hold", {
      body: holdBody("08015550002", h6bSlot[0]!, "Slot Taker"),
      ip: "10.255.1.72",
    });
    assert.ok(taker.status < 300, `taker ${taker.status} ${JSON.stringify(taker.data)}`);
    const hookB = await postWebhook({
      id: `evt_h6b_${victim.data.reference}`,
      type: "collection.succeeded",
      reference: victim.data.reference,
      checkoutId: `mock_${victim.data.reference}`,
    });
    assert.ok(hookB.status < 300);
    const stB = await api<{ status: string; payment: { status: string } }>(
      "GET",
      `/bookings/${victim.data.bookingId}/status?reference=${encodeURIComponent(victim.data.reference)}`,
      { ip: "10.255.1.71" },
    );
    assert.equal(stB.data.payment.status, "SUCCESS");
    assert.notEqual(stB.data.status, "CONFIRMED");
    const takerSt = await api<{ status: string }>(
      "GET",
      `/bookings/${taker.data.bookingId}/status?reference=${encodeURIComponent(taker.data.reference)}`,
      { ip: "10.255.1.72" },
    );
    assert.equal(takerSt.data.status, "TEMPORARY_HOLD");
    console.log("21. Expired hold + slot taken + payment → not CONFIRMED ✓");

    const dup = await postWebhook({
      id: `evt_h6a_${h6a.data.reference}`,
      type: "collection.succeeded",
      reference: h6a.data.reference,
      checkoutId: `mock_${h6a.data.reference}`,
    });
    assert.equal(dup.data.duplicate, true);
    console.log("22. Duplicate webhook → idempotent ✓");

    const originalPhone = `0801${stamp}003`;
    const original = await prisma.customer.findUnique({ where: { phone: originalPhone } });
    if (original) {
      const steal = await api<{ bookingId: string }>("POST", "/bookings/hold", {
        body: {
          packageId: pkg.id,
          startTime: (await firstPackageAndSlots(1, "10.255.1.80")).slots[0],
          customerName: "Attacker",
          customerPhone: originalPhone,
          customerEmail: "attacker@example.com",
        },
        ip: "10.255.1.80",
      });
      assert.ok(steal.status < 300 || steal.status === 409, `m7 ${steal.status}`);
      const after = await prisma.customer.findUnique({ where: { phone: originalPhone } });
      assert.equal(after?.email, original.email);
      assert.equal(after?.name, original.name);
      console.log("M7. Existing customer PII preserved ✓");
    }

    console.log("23. Happy-path pieces covered by verify:payment-flow");
    console.log("All security tests passed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
