import "./load-env";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

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
  console.log("Starting verification of Admin Email Editing...");
  const prisma = new PrismaClient();

    const ownerUser = await prisma.user.findFirst({ where: { role: "OWNER" } });
    const ownerEmail = (ownerUser?.email ?? process.env.SEED_OWNER_EMAIL ?? "owner@photoarenang.com").trim().toLowerCase();
    const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme";

    // 1. Owner Login
    const ownerLogin = await api<{ token: string; user: { id: string } }>("POST", "/auth/login", {
      body: { email: ownerEmail, password: ownerPassword },
    });
    assert.equal(ownerLogin.status, 201, `Owner login failed: ${JSON.stringify(ownerLogin.data)}`);
    const ownerToken = ownerLogin.data.token;
    console.log("✓ Step 1: Owner logged in");

    // 2. Create test admin user
    const stamp = Date.now();
    const initialAdminEmail = `admin-edit-${stamp}@example.com`;
    const adminPassword = "InitialAdminPass123";

    const createAdmin = await api<{ id: string; email: string }>("POST", "/admin/users", {
      token: ownerToken,
      body: {
        name: "Admin Editable",
        email: initialAdminEmail,
        role: "ADMIN",
        password: adminPassword,
        fullAccess: true,
      },
    });
    assert.equal(createAdmin.status, 201, `Failed to create test admin: ${JSON.stringify(createAdmin.data)}`);
    const adminId = createAdmin.data.id;
    console.log("✓ Step 2: Test admin created:", initialAdminEmail);

    // 3. Admin login with desk password
    const adminLogin = await api<{ token: string; user: { id: string; email: string } }>("POST", "/auth/login", {
      body: { email: ownerEmail, password: adminPassword },
    });
    assert.equal(adminLogin.status, 201, `Admin login failed: ${JSON.stringify(adminLogin.data)}`);
    const adminToken = adminLogin.data.token;
    assert.equal(adminLogin.data.user.email, initialAdminEmail);
    console.log("✓ Step 3: Admin logged in with desk password");

    // 4. Test wrong password on PATCH /auth/account
    const wrongPassRes = await api("PATCH", "/auth/account", {
      token: adminToken,
      body: {
        email: `new-${stamp}@example.com`,
        currentPassword: "WrongPassword999",
      },
    });
    assert.equal(wrongPassRes.status, 403, "Wrong current password must be rejected with 403");
    console.log("✓ Step 4: Wrong current password correctly rejected (403)");

    // 5. Test duplicate email collision
    const dupRes = await api("PATCH", "/auth/account", {
      token: adminToken,
      body: {
        email: ownerEmail,
        currentPassword: adminPassword,
      },
    });
    assert.equal(dupRes.status, 400, "Duplicate email collision must be rejected with 400");
    console.log("✓ Step 5: Duplicate email collision correctly rejected (400)");

    // 6. Test valid email update via PATCH /auth/account
    const newAdminEmail = `updated-admin-${stamp}@example.com`;
    const updateRes = await api<{ user: { id: string; email: string; name: string }; token: string }>(
      "PATCH",
      "/auth/account",
      {
        token: adminToken,
        body: {
          email: newAdminEmail,
          name: "Admin Edited Name",
          currentPassword: adminPassword,
        },
      },
    );
    assert.equal(updateRes.status, 200, `Account update failed: ${JSON.stringify(updateRes.data)}`);
    assert.equal(updateRes.data.user.email, newAdminEmail, "Returned user email must match new email");
    assert.equal(updateRes.data.user.name, "Admin Edited Name");
    assert.ok(updateRes.data.token, "A fresh token must be returned");
    console.log("✓ Step 6: Admin successfully updated email via /auth/account to:", newAdminEmail);

    // 7. Verify DB reflects the new email
    const dbUser = await prisma.user.findUnique({ where: { id: adminId } });
    assert.equal(dbUser?.email, newAdminEmail, "DB email must be updated");
    assert.equal(dbUser?.name, "Admin Edited Name");
    console.log("✓ Step 7: Database verified with new email and name");

    // 8. Verify /auth/me returns the new email
    const meRes = await api<{ id: string; email: string; name: string }>("GET", "/auth/me", {
      token: updateRes.data.token,
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.email, newAdminEmail);
    console.log("✓ Step 8: GET /auth/me returns new email");

    // 9. Admin updates own email via PATCH /admin/users/:id
    const usersPageEmail = `users-page-admin-${stamp}@example.com`;
    const patchUserRes = await api<{ id: string; email: string }>("PATCH", `/admin/users/${adminId}`, {
      token: updateRes.data.token,
      body: {
        email: usersPageEmail,
        name: "Admin Final",
      },
    });
    assert.equal(patchUserRes.status, 200, `PATCH /admin/users/:id failed: ${JSON.stringify(patchUserRes.data)}`);
    assert.equal(patchUserRes.data.email, usersPageEmail);
    console.log("✓ Step 9: Admin updated own email via /admin/users/:id to:", usersPageEmail);

    // 10. Admin tries to promote someone or self to OWNER (must fail 403)
    const promoteAttempt = await api("PATCH", `/admin/users/${adminId}`, {
      token: updateRes.data.token,
      body: {
        role: "OWNER",
      },
    });
    assert.equal(promoteAttempt.status, 403, "Admin cannot assign OWNER role (must be 403)");
    console.log("✓ Step 10: Non-owner admin cannot assign OWNER role (403 verified)");

    // 11. Create a staff user to test deletion/deactivation by admin
    const staffEmail = `staff-test-${stamp}@example.com`;
    const createStaff = await api<{ id: string; email: string }>("POST", "/admin/users", {
      token: ownerToken,
      body: {
        name: "Staff Test User",
        email: staffEmail,
        role: "STAFF",
        password: "StaffPassword123",
      },
    });
    assert.equal(createStaff.status, 201, `Failed to create test staff: ${JSON.stringify(createStaff.data)}`);
    const staffId = createStaff.data.id;
    console.log("✓ Step 11: Created test staff user:", staffEmail);

    // 12. Admin attempts to delete Owner via DELETE /admin/users/:ownerId (must fail 403)
    const adminDeleteOwner = await api("DELETE", `/admin/users/${ownerLogin.data.user.id}`, {
      token: updateRes.data.token,
    });
    assert.equal(adminDeleteOwner.status, 403, "Admin deleting owner must be rejected with 403");
    console.log("✓ Step 12: Admin deleting owner correctly rejected (403)");

    // 13. Admin attempts to deactivate Owner via PATCH /admin/users/:ownerId (must fail 403)
    const adminDeactivateOwner = await api("PATCH", `/admin/users/${ownerLogin.data.user.id}`, {
      token: updateRes.data.token,
      body: { isActive: false },
    });
    assert.equal(adminDeactivateOwner.status, 403, "Admin deactivating owner must be rejected with 403");
    console.log("✓ Step 13: Admin deactivating owner correctly rejected (403)");

    // 14. Admin attempts to delete/deactivate self (must fail 403)
    const adminDeleteSelf = await api("DELETE", `/admin/users/${adminId}`, {
      token: updateRes.data.token,
    });
    assert.equal(adminDeleteSelf.status, 403, "Admin deleting self must be rejected with 403");
    console.log("✓ Step 14: Admin deleting self correctly rejected (403)");

    // 15. Admin deletes staff user via DELETE /admin/users/:staffId (must succeed 200)
    const adminDeleteStaff = await api<{ id: string; isActive: boolean }>("DELETE", `/admin/users/${staffId}`, {
      token: updateRes.data.token,
    });
    assert.equal(adminDeleteStaff.status, 200, `Admin deleting staff failed: ${JSON.stringify(adminDeleteStaff.data)}`);
    assert.equal(adminDeleteStaff.data.isActive, false, "Staff user should be marked isActive=false");

    // Verify in database
    const dbStaff = await prisma.user.findUnique({ where: { id: staffId } });
    assert.equal(dbStaff?.isActive, false, "DB staff user must be inactive");
    assert.ok((dbStaff?.tokenVersion ?? 0) >= 1, "Token version must be incremented");
    console.log("✓ Step 15: Admin successfully deleted staff user (soft delete isActive=false)");

    // 16. Admin reactivates and deactivates staff user via PATCH /admin/users/:staffId
    const adminReactivateStaff = await api<{ id: string; isActive: boolean }>("PATCH", `/admin/users/${staffId}`, {
      token: updateRes.data.token,
      body: { isActive: true },
    });
    assert.equal(adminReactivateStaff.status, 200, "Admin reactivating staff must succeed");
    assert.equal(adminReactivateStaff.data.isActive, true);

    const adminDeactivateStaff = await api<{ id: string; isActive: boolean }>("PATCH", `/admin/users/${staffId}`, {
      token: updateRes.data.token,
      body: { isActive: false },
    });
    assert.equal(adminDeactivateStaff.status, 200, "Admin deactivating staff must succeed");
    assert.equal(adminDeactivateStaff.data.isActive, false);
    console.log("✓ Step 16: Admin toggled staff active status via PATCH /admin/users/:id");

    // Cleanup
    await prisma.user.delete({ where: { id: staffId } });
    await prisma.user.delete({ where: { id: adminId } });
    console.log("✓ Cleanup: Removed test staff and admin users");

    console.log("\n==============================================");
    console.log("ALL ADMIN EMAIL EDIT VERIFICATIONS PASSED 100%");
    console.log("==============================================\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
