import "./load-env";
import assert from "node:assert/strict";
import { PrismaClient, Role } from "@prisma/client";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");

async function api<T = unknown>(
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
  console.log("===============================================================");
  console.log("🔒 STARTING RBAC / ROLE & PERMISSION ACCESS VERIFICATION SUITE");
  console.log("===============================================================");
  const prisma = new PrismaClient();

  const stamp = Date.now();
  const ownerEmail = (await api<{ email: string }>("GET", "/auth/desk-email")).data.email.trim().toLowerCase();
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme";

  // Login as OWNER
  const ownerLogin = await api<{ token: string; user: { id: string } }>("POST", "/auth/login", {
    body: { email: ownerEmail, password: ownerPassword },
  });
  assert.equal(ownerLogin.status, 201, "Owner login failed");
  const ownerToken = ownerLogin.data.token;
  const ownerId = ownerLogin.data.user.id;

  const createdUserIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // SETUP TEST USERS
    // -------------------------------------------------------------
    // User A: Full ADMIN (role=ADMIN, fullAccess=true)
    const adminFullPass = `AdminFull_${stamp}!`;
    const adminFullRes = await api<{ id: string }>("POST", "/admin/users", {
      token: ownerToken,
      body: {
        name: "Admin Full Access",
        email: `admin-full-${stamp}@example.com`,
        role: Role.ADMIN,
        password: adminFullPass,
        fullAccess: true,
      },
    });
    assert.equal(adminFullRes.status, 201, `Failed to create Admin Full: ${JSON.stringify(adminFullRes.data)}`);
    const adminFullId = adminFullRes.data.id;
    createdUserIds.push(adminFullId);

    const adminFullLogin = await api<{ token: string }>("POST", "/auth/login", {
      body: { email: ownerEmail, password: adminFullPass },
    });
    assert.equal(adminFullLogin.status, 201);
    const adminFullToken = adminFullLogin.data.token;

    // User B: Scoped ADMIN (role=ADMIN, permissions=['bookings', 'customers'])
    const adminScopedPass = `AdminScoped_${stamp}!`;
    const adminScopedRes = await api<{ id: string }>("POST", "/admin/users", {
      token: ownerToken,
      body: {
        name: "Admin Scoped Bookings Customers",
        email: `admin-scoped-${stamp}@example.com`,
        role: Role.ADMIN,
        password: adminScopedPass,
        fullAccess: false,
        permissions: ["bookings", "customers"],
      },
    });
    assert.equal(adminScopedRes.status, 201);
    const adminScopedId = adminScopedRes.data.id;
    createdUserIds.push(adminScopedId);

    const adminScopedLogin = await api<{ token: string }>("POST", "/auth/login", {
      body: { email: ownerEmail, password: adminScopedPass },
    });
    assert.equal(adminScopedLogin.status, 201);
    const adminScopedToken = adminScopedLogin.data.token;

    // User C: Scoped STAFF (role=STAFF, permissions=['bookings', 'gallery'])
    const staffScopedPass = `StaffScoped_${stamp}!`;
    const staffScopedRes = await api<{ id: string }>("POST", "/admin/users", {
      token: ownerToken,
      body: {
        name: "Staff Scoped Bookings Gallery",
        email: `staff-scoped-${stamp}@example.com`,
        role: Role.STAFF,
        password: staffScopedPass,
        fullAccess: false,
        permissions: ["bookings", "gallery", "content"],
      },
    });
    assert.equal(staffScopedRes.status, 201);
    const staffScopedId = staffScopedRes.data.id;
    createdUserIds.push(staffScopedId);

    const staffScopedLogin = await api<{ token: string }>("POST", "/auth/login", {
      body: { email: ownerEmail, password: staffScopedPass },
    });
    assert.equal(staffScopedLogin.status, 201);
    const staffScopedToken = staffScopedLogin.data.token;

    // User D: Zero Permission STAFF (role=STAFF, permissions=[])
    const staffZeroPass = `StaffZero_${stamp}!`;
    const staffZeroRes = await api<{ id: string }>("POST", "/admin/users", {
      token: ownerToken,
      body: {
        name: "Staff Zero Perms",
        email: `staff-zero-${stamp}@example.com`,
        role: Role.STAFF,
        password: staffZeroPass,
        fullAccess: false,
        permissions: [],
      },
    });
    assert.equal(staffZeroRes.status, 201);
    const staffZeroId = staffZeroRes.data.id;
    createdUserIds.push(staffZeroId);

    const staffZeroLogin = await api<{ token: string }>("POST", "/auth/login", {
      body: { email: ownerEmail, password: staffZeroPass },
    });
    assert.equal(staffZeroLogin.status, 201);
    const staffZeroToken = staffZeroLogin.data.token;

    console.log("✓ Setup: Created test users with varying roles and permission sets\n");

    // =============================================================
    // SUITE 1: OWNER ACCESS (FULL UNRESTRICTED ACCESS)
    // =============================================================
    console.log("--- [Suite 1: OWNER Role Verification] ---");
    const ownerUsers = await api("GET", "/admin/users", { token: ownerToken });
    assert.equal(ownerUsers.status, 200, "Owner must be able to list users");

    const ownerBookings = await api("GET", "/admin/bookings", { token: ownerToken });
    assert.equal(ownerBookings.status, 200, "Owner must be able to list bookings");

    const ownerPayments = await api("GET", "/admin/payments", { token: ownerToken });
    assert.equal(ownerPayments.status, 200, "Owner must be able to list payments");

    const ownerAudit = await api("GET", "/admin/audit", { token: ownerToken });
    assert.equal(ownerAudit.status, 200, "Owner must be able to access audit log");

    const ownerSettings = await api("GET", "/admin/settings", { token: ownerToken });
    assert.equal(ownerSettings.status, 200, "Owner must be able to get settings");
    console.log("✓ Suite 1 Passed: OWNER has full access to all areas");

    // =============================================================
    // SUITE 2: ADMIN WITH FULL ACCESS (CANNOT DO OWNER-ONLY ACTIONS)
    // =============================================================
    console.log("\n--- [Suite 2: ADMIN Full Access & Owner-Only Action Restrictions] ---");
    // Allowed actions for ADMIN with full access
    const adminFullUsers = await api("GET", "/admin/users", { token: adminFullToken });
    assert.equal(adminFullUsers.status, 200, "Full ADMIN can list users");

    const adminFullBookings = await api("GET", "/admin/bookings", { token: adminFullToken });
    assert.equal(adminFullBookings.status, 200, "Full ADMIN can list bookings");

    const adminFullPayments = await api("GET", "/admin/payments", { token: adminFullToken });
    assert.equal(adminFullPayments.status, 200, "Full ADMIN can list payments");

    // RESTRICTION 2.1: ADMIN cannot create new users (Roles(Role.OWNER))
    const adminCreateUser = await api("POST", "/admin/users", {
      token: adminFullToken,
      body: {
        name: "Illegal User",
        email: `illegal-${stamp}@example.com`,
        role: Role.STAFF,
        password: "IllegalPass123!",
      },
    });
    assert.equal(adminCreateUser.status, 403, "ADMIN must be FORBIDDEN (403) from creating users");
    console.log("✓ Admin prevented from creating new users (403)");

    // RESTRICTION 2.2: ADMIN cannot reset another user's password (Roles(Role.OWNER))
    const adminResetPass = await api("POST", `/admin/users/${staffScopedId}/reset-password`, {
      token: adminFullToken,
      body: { password: "HackedPass123!" },
    });
    assert.equal(adminResetPass.status, 403, "ADMIN must be FORBIDDEN (403) from resetting user passwords");
    console.log("✓ Admin prevented from resetting another user's password (403)");

    // RESTRICTION 2.3: ADMIN cannot revoke another user's sessions (Roles(Role.OWNER))
    const adminRevokeUser = await api("POST", `/admin/users/${staffScopedId}/revoke-sessions`, {
      token: adminFullToken,
    });
    assert.equal(adminRevokeUser.status, 403, "ADMIN must be FORBIDDEN (403) from revoking other users' sessions");
    console.log("✓ Admin prevented from revoking another user's sessions (403)");

    // RESTRICTION 2.4: ADMIN cannot modify permissions of another user
    const adminChangePerms = await api("PATCH", `/admin/users/${staffScopedId}`, {
      token: adminFullToken,
      body: { fullAccess: true },
    });
    assert.equal(adminChangePerms.status, 403, "ADMIN must be FORBIDDEN (403) from modifying user permissions");
    console.log("✓ Admin prevented from modifying permissions of other users (403)");

    // RESTRICTION 2.5: ADMIN cannot demote/deactivate or modify OWNER account
    const adminDemoteOwner = await api("PATCH", `/admin/users/${ownerId}`, {
      token: adminFullToken,
      body: { name: "Hacked Owner Name" },
    });
    assert.equal(adminDemoteOwner.status, 403, "ADMIN must be FORBIDDEN (403) from modifying owner accounts");
    console.log("✓ Admin prevented from modifying OWNER accounts (403)");

    // RESTRICTION 2.6: ADMIN cannot escalate any account to OWNER
    const adminEscalate = await api("PATCH", `/admin/users/${staffScopedId}`, {
      token: adminFullToken,
      body: { role: Role.OWNER },
    });
    assert.equal(adminEscalate.status, 403, "ADMIN must be FORBIDDEN (403) from promoting accounts to OWNER");
    console.log("✓ Admin prevented from promoting accounts to OWNER (403)");
    console.log("✓ Suite 2 Passed: All ADMIN restriction barriers verified");

    // =============================================================
    // SUITE 3: SCOPED ADMIN (RESTRICTED TO ['bookings', 'customers'])
    // =============================================================
    console.log("\n--- [Suite 3: SCOPED ADMIN Permission Boundary Verification] ---");
    // Allowed areas
    const scopedAdminBookings = await api("GET", "/admin/bookings", { token: adminScopedToken });
    assert.equal(scopedAdminBookings.status, 200, "Scoped ADMIN allowed to access bookings");

    const scopedAdminCustomers = await api("GET", "/admin/customers", { token: adminScopedToken });
    assert.equal(scopedAdminCustomers.status, 200, "Scoped ADMIN allowed to access customers");

    // Disallowed areas (Must return 403)
    const scopedAdminPayments = await api("GET", "/admin/payments", { token: adminScopedToken });
    assert.equal(scopedAdminPayments.status, 403, "Scoped ADMIN must be FORBIDDEN from payments");

    const scopedAdminAudit = await api("GET", "/admin/audit", { token: adminScopedToken });
    assert.equal(scopedAdminAudit.status, 403, "Scoped ADMIN must be FORBIDDEN from audit logs");

    const scopedAdminEnquiries = await api("GET", "/admin/enquiries", { token: adminScopedToken });
    assert.equal(scopedAdminEnquiries.status, 403, "Scoped ADMIN must be FORBIDDEN from enquiries");

    const scopedAdminGallery = await api("GET", "/admin/gallery", { token: adminScopedToken });
    assert.equal(scopedAdminGallery.status, 403, "Scoped ADMIN must be FORBIDDEN from gallery");

    const scopedAdminUsers = await api("GET", "/admin/users", { token: adminScopedToken });
    assert.equal(scopedAdminUsers.status, 403, "Scoped ADMIN must be FORBIDDEN from users (no 'users' permission)");

    const scopedAdminSettings = await api("GET", "/admin/settings", { token: adminScopedToken });
    assert.equal(scopedAdminSettings.status, 403, "Scoped ADMIN must be FORBIDDEN from settings (no 'content' permission)");
    console.log("✓ Suite 3 Passed: Scoped ADMIN accurately blocked from ungranted areas (403)");

    // =============================================================
    // SUITE 4: SCOPED STAFF (RESTRICTED TO ['bookings', 'gallery', 'content'])
    // =============================================================
    console.log("\n--- [Suite 4: SCOPED STAFF Role & Permission Verification] ---");
    // Allowed areas
    const staffBookings = await api("GET", "/admin/bookings", { token: staffScopedToken });
    assert.equal(staffBookings.status, 200, "Scoped STAFF allowed to access bookings");

    const staffGallery = await api("GET", "/admin/gallery", { token: staffScopedToken });
    assert.equal(staffGallery.status, 200, "Scoped STAFF allowed to access gallery");

    const staffSettingsGet = await api("GET", "/admin/settings", { token: staffScopedToken });
    assert.equal(staffSettingsGet.status, 200, "Scoped STAFF with 'content' allowed GET /admin/settings");

    // Disallowed due to missing permission
    const staffPayments = await api("GET", "/admin/payments", { token: staffScopedToken });
    assert.equal(staffPayments.status, 403, "Scoped STAFF blocked from payments (403)");

    const staffAudit = await api("GET", "/admin/audit", { token: staffScopedToken });
    assert.equal(staffAudit.status, 403, "Scoped STAFF blocked from audit logs (403)");

    const staffCustomers = await api("GET", "/admin/customers", { token: staffScopedToken });
    assert.equal(staffCustomers.status, 403, "Scoped STAFF blocked from customers (403)");

    // Disallowed due to Role requirement (@Roles(Role.OWNER, Role.ADMIN))
    // 1. /admin/users list requires OWNER or ADMIN role
    const staffUsersList = await api("GET", "/admin/users", { token: staffScopedToken });
    assert.equal(staffUsersList.status, 403, "STAFF blocked from /admin/users list (Role requirement)");

    // 2. PUT /admin/settings requires OWNER or ADMIN role (STAFF cannot modify settings)
    const staffSettingsPut = await api("PUT", "/admin/settings", {
      token: staffScopedToken,
      body: { "site.tagline": "Hacked" },
    });
    assert.equal(staffSettingsPut.status, 403, "STAFF blocked from updating settings (PUT requires ADMIN/OWNER)");
    console.log("✓ Suite 4 Passed: Scoped STAFF correctly allowed in permitted areas and blocked elsewhere");

    // =============================================================
    // SUITE 5: ZERO PERMISSION STAFF (permissions: [])
    // =============================================================
    console.log("\n--- [Suite 5: ZERO PERMISSION STAFF Complete Isolation] ---");
    const endpointsToTest = [
      { method: "GET", path: "/admin/bookings", name: "bookings" },
      { method: "GET", path: "/admin/payments", name: "payments" },
      { method: "GET", path: "/admin/customers", name: "customers" },
      { method: "GET", path: "/admin/enquiries", name: "enquiries" },
      { method: "GET", path: "/admin/gallery", name: "gallery" },
      { method: "GET", path: "/admin/audit", name: "audit" },
      { method: "GET", path: "/admin/settings", name: "settings" },
      { method: "GET", path: "/admin/users", name: "users" },
      { method: "GET", path: "/admin/dashboard", name: "dashboard" },
    ];

    for (const ep of endpointsToTest) {
      const res = await api(ep.method, ep.path, { token: staffZeroToken });
      assert.equal(res.status, 403, `Zero permission staff must be FORBIDDEN (403) from ${ep.path}`);
    }
    console.log("✓ Suite 5 Passed: Zero-permission staff blocked across ALL admin endpoints (403)");

    // =============================================================
    // SUITE 6: SELF-DEACTIVATION & SELF-DEMOTION PROTECTION
    // =============================================================
    console.log("\n--- [Suite 6: Self-Demotion and Last-Owner Protection] ---");
    // Owner cannot demote or deactivate themselves when they are the only owner
    const ownerSelfDemote = await api("PATCH", `/admin/users/${ownerId}`, {
      token: ownerToken,
      body: { role: Role.ADMIN },
    });
    assert.equal(ownerSelfDemote.status, 400, "Last owner cannot demote themselves (400)");

    // Admin cannot deactivate themselves via /admin/users/:id
    const adminSelfDeactivate = await api("PATCH", `/admin/users/${adminFullId}`, {
      token: adminFullToken,
      body: { isActive: false },
    });
    assert.equal(adminSelfDeactivate.status, 403, "User cannot deactivate themselves (403)");
    console.log("✓ Suite 6 Passed: Self-demotion and last-owner safety checks enforced");

    console.log("\n===============================================================");
    console.log("🎉 ALL RBAC ROLE & PERMISSION ACCESS TESTS PASSED (100%)");
    console.log("===============================================================");
  } finally {
    // Cleanup test users
    for (const uid of createdUserIds) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: uid } });
      await prisma.auditLog.deleteMany({ where: { entityId: uid } });
      await prisma.user.deleteMany({ where: { id: uid } });
    }
    await prisma.$disconnect();
    console.log("✓ Test users cleaned up successfully");
  }
}

main().catch((err) => {
  console.error("❌ RBAC Verification failed:", err);
  process.exit(1);
});
