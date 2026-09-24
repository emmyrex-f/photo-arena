/**
 * Live AUTH-1..AUTH-3 checks against a running API.
 * Env: API_BASE, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD
 */
import "./load-env";
import assert from "node:assert/strict";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");
const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? "owner@photoarenang.com").trim().toLowerCase();
const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme";

type Json = Record<string, unknown>;

async function api<T = Json>(
  method: string,
  path: string,
  opts?: { body?: unknown; token?: string },
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {};
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
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

async function main() {
  const desk = await api<{ email: string }>("GET", "/auth/desk-email");
  assert.equal(desk.status, 200, `desk-email ${desk.status}`);
  assert.equal(desk.data.email.toLowerCase(), ownerEmail);

  const ownerLogin = await api<{ token: string; user: { role: string; permissions: string[] } }>(
    "POST",
    "/auth/login",
    { body: { email: ownerEmail, password: ownerPassword } },
  );
  assert.ok(ownerLogin.status < 300, `owner login ${ownerLogin.status}`);
  assert.equal(ownerLogin.data.user.role, "OWNER");
  assert.ok(ownerLogin.data.user.permissions.includes("*"));
  const ownerToken = ownerLogin.data.token;
  console.log("OWNER login + full permissions ✓");

  const stamp = Date.now();
  const adminPass = `AdminPass${stamp}`;
  const created = await api<{ id: string; permissions: string[] }>("POST", "/admin/users", {
    token: ownerToken,
    body: {
      email: `auth-admin-${stamp}@example.com`,
      name: "Auth Admin",
      role: "ADMIN",
      password: adminPass,
      fullAccess: false,
      permissions: ["dashboard", "bookings"],
    },
  });
  assert.ok(created.status < 300, `create admin ${created.status} ${JSON.stringify(created.data)}`);
  assert.deepEqual(created.data.permissions, ["dashboard", "bookings"]);
  console.log("ADMIN permissions persisted on create ✓");

  const badEmail = await api("POST", "/auth/login", {
    body: { email: `auth-admin-${stamp}@example.com`, password: adminPass },
  });
  assert.equal(badEmail.status, 401);
  console.log("AUTH-1 non-desk email rejected ✓");

  const adminLogin = await api<{ token: string; user: { role: string; permissions: string[] } }>(
    "POST",
    "/auth/login",
    { body: { email: ownerEmail, password: adminPass } },
  );
  assert.ok(adminLogin.status < 300, `admin login ${adminLogin.status}`);
  assert.equal(adminLogin.data.user.role, "ADMIN");
  assert.deepEqual(adminLogin.data.user.permissions, ["dashboard", "bookings"]);
  console.log("AUTH-1 password selects ADMIN ✓");

  const me = await api<{ permissions: string[] }>("GET", "/auth/me", { token: adminLogin.data.token });
  assert.equal(me.status, 200);
  assert.deepEqual(me.data.permissions, ["dashboard", "bookings"]);
  console.log("AUTH-2 /auth/me reloads permissions ✓");

  const bookings = await api("GET", "/admin/bookings?page=1&pageSize=1", {
    token: adminLogin.data.token,
  });
  assert.ok(bookings.status < 300, `bookings ${bookings.status}`);
  const payments = await api("GET", "/admin/payments?page=1&pageSize=1", {
    token: adminLogin.data.token,
  });
  assert.equal(payments.status, 403);
  console.log("AUTH-2 RequirePermission honors DB list ✓");

  await api("PATCH", `/admin/users/${created.data.id}`, {
    token: ownerToken,
    body: { permissions: ["dashboard"], fullAccess: false },
  });
  const afterRevoke = await api("GET", "/admin/bookings?page=1&pageSize=1", {
    token: adminLogin.data.token,
  });
  assert.equal(afterRevoke.status, 401, "tokenVersion bump must kill session");
  console.log("Permission change invalidates session ✓");

  const staffPass = `StaffPass${stamp}`;
  const staff = await api<{ id: string }>("POST", "/admin/users", {
    token: ownerToken,
    body: {
      email: `auth-staff-${stamp}@example.com`,
      name: "Auth Staff",
      role: "STAFF",
      password: staffPass,
      fullAccess: false,
      permissions: [],
    },
  });
  assert.ok(staff.status < 300, `create staff ${staff.status}`);
  const staffLogin = await api<{ token: string; user: { role: string; permissions: string[] } }>(
    "POST",
    "/auth/login",
    { body: { email: ownerEmail, password: staffPass } },
  );
  assert.ok(staffLogin.status < 300, `staff login ${staffLogin.status}`);
  assert.equal(staffLogin.data.user.role, "STAFF");
  assert.deepEqual(staffLogin.data.user.permissions, []);
  const staffDash = await api("GET", "/admin/dashboard", { token: staffLogin.data.token });
  assert.equal(staffDash.status, 403);
  console.log("AUTH-3 STAFF empty permissions denied ✓");

  await api("DELETE", `/admin/users/${created.data.id}`, { token: ownerToken });
  await api("DELETE", `/admin/users/${staff.data.id}`, { token: ownerToken });
  console.log("AUTH-1..AUTH-3 live verification passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
