/**
 * SEC-M1: public booking status must not leak customer PII by id alone.
 */
import "./load-env";
import assert from "node:assert/strict";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");

type Json = Record<string, unknown>;

async function api<T = Json>(
  method: string,
  path: string,
  opts?: { body?: unknown; ip?: string },
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {};
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

async function main() {
  const packages = await api<
    Array<{ packages: Array<{ id: string; durationMinutes: number }> }>
  >("GET", "/bookings/packages", { ip: "10.255.11.1" });
  assert.ok(packages.status < 300);
  const pkg = packages.data[0]?.packages?.[0];
  assert.ok(pkg);

  let slot = "";
  for (let day = 2; day <= 14 && !slot; day += 1) {
    const date = lagosDateOffset(day);
    const avail = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(date)}&durationMinutes=${pkg.durationMinutes}`,
      { ip: "10.255.11.1" },
    );
    slot = avail.data.slots?.[0] ?? "";
  }
  assert.ok(slot, "need slot");

  const stamp = Date.now();
  const hold = await api<{ bookingId: string; reference: string }>("POST", "/bookings/hold", {
    ip: "10.255.11.2",
    body: {
      packageId: pkg.id,
      startTime: slot,
      customerName: `Status PII ${stamp}`,
      customerPhone: `0805${String(stamp).slice(-7)}`,
      customerEmail: `status-pii-${stamp}@example.com`,
    },
  });
  assert.ok(hold.status < 300, `hold ${hold.status}`);
  const { bookingId, reference } = hold.data;

  const noRef = await api<{ message?: string | string[] }>(
    "GET",
    `/bookings/${bookingId}/status`,
    { ip: "10.255.11.3" },
  );
  assert.equal(noRef.status, 400, `id-only must be rejected (got ${noRef.status})`);
  assert.ok(!JSON.stringify(noRef.data).includes("status-pii-"), "no email in error body");
  console.log("id-only status → 400 ✓");

  const wrongRef = await api("GET", `/bookings/${bookingId}/status?reference=PA-WRONGREF0`, {
    ip: "10.255.11.3",
  });
  assert.ok(wrongRef.status === 403 || wrongRef.status === 400, `wrong ref ${wrongRef.status}`);
  assert.ok(!JSON.stringify(wrongRef.data).toLowerCase().includes("@example.com"));
  console.log("wrong reference → rejected ✓");

  const ok = await api<{
    status: string;
    reference: string;
    customer: { name?: string; email?: string | null; phone?: string };
  }>("GET", `/bookings/${bookingId}/status?reference=${encodeURIComponent(reference)}`, {
    ip: "10.255.11.3",
  });
  assert.ok(ok.status < 300, `legit status ${ok.status}`);
  assert.equal(ok.data.reference, reference);
  assert.equal(ok.data.customer.name, `Status PII ${stamp}`);
  assert.equal(ok.data.customer.email, undefined);
  assert.equal(ok.data.customer.phone, undefined);
  assert.ok(!JSON.stringify(ok.data).includes(`status-pii-${stamp}@example.com`));
  console.log("matching reference → status without email/phone ✓");

  const checkout = await api("POST", `/bookings/${bookingId}/checkout`, {
    ip: "10.255.11.2",
    body: {
      reference,
      returnUrl: "http://localhost:5173/book/confirmation",
      cancelUrl: "http://localhost:5173/book",
    },
  });
  assert.ok(checkout.status < 300, `checkout ${checkout.status}`);

  const verify = await api<{ customer: { email?: string | null; phone?: string; name?: string } }>(
    "GET",
    `/payments/verify?reference=${encodeURIComponent(reference)}`,
    { ip: "10.255.11.3" },
  );
  assert.ok(verify.status < 300, `verify ${verify.status}`);
  assert.equal(verify.data.customer.email, undefined);
  assert.equal(verify.data.customer.phone, undefined);
  assert.ok(!JSON.stringify(verify.data).includes(`status-pii-${stamp}@example.com`));
  console.log("payments/verify also omits email/phone ✓");

  console.log("\nSEC-M1 booking status privacy verification passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
