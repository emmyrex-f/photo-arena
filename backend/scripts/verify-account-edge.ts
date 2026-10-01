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
  console.log("=================================================");
  console.log("🚀 STARTING USER ACCOUNT FEATURE EDGE TEST SUITE");
  console.log("=================================================");
  const prisma = new PrismaClient();

  const stamp = Date.now();
  const testUser1Email = `test-acc1-${stamp}@example.com`;
  const testUser2Email = `test-acc2-${stamp}@example.com`;
  const user1Pass = "InitialSecret123!";
  const user2Pass = "UserTwoSecret456!";

  let user1Id = "";
  let user2Id = "";

  try {
    // 0. Get desk owner token to create test users
    const desk = await api<{ email: string }>("GET", "/auth/desk-email");
    assert.equal(desk.status, 200, `desk-email should return 200: ${desk.status}`);
    const ownerEmail = desk.data.email.trim().toLowerCase();
    const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme";

    const ownerLogin = await api<{ token: string; user: { id: string } }>("POST", "/auth/login", {
      body: { email: ownerEmail, password: ownerPassword },
    });
    assert.equal(ownerLogin.status, 201, `Owner login failed: ${JSON.stringify(ownerLogin.data)}`);
    const ownerToken = ownerLogin.data.token;

    // Create 2 test users for collision and uniqueness tests
    const u1Res = await api<{ id: string }>("POST", "/admin/users", {
      token: ownerToken,
      body: {
        name: "Test Account User 1",
        email: testUser1Email,
        role: "ADMIN",
        password: user1Pass,
        fullAccess: true,
      },
    });
    assert.equal(u1Res.status, 201, `Create User 1 failed: ${JSON.stringify(u1Res.data)}`);
    user1Id = u1Res.data.id;

    const u2Res = await api<{ id: string }>("POST", "/admin/users", {
      token: ownerToken,
      body: {
        name: "Test Account User 2",
        email: testUser2Email,
        role: "STAFF",
        password: user2Pass,
        fullAccess: false,
      },
    });
    assert.equal(u2Res.status, 201, `Create User 2 failed: ${JSON.stringify(u2Res.data)}`);
    user2Id = u2Res.data.id;

    console.log("✓ Setup: Created test users 1 & 2");

    // Login as User 1
    const u1Login = await api<{ token: string; user: { id: string; email: string; name: string } }>(
      "POST",
      "/auth/login",
      {
        body: { email: ownerEmail, password: user1Pass },
      },
    );
    assert.equal(u1Login.status, 201, "User 1 login failed");
    let u1Token = u1Login.data.token;

    // --- EDGE CASE 1: Unauthenticated Requests ---
    console.log("\n[Edge Case 1] Unauthenticated requests rejection");
    const unauthMe = await api("GET", "/auth/me");
    assert.equal(unauthMe.status, 401, "Unauth /auth/me should return 401");

    const unauthPatch = await api("PATCH", "/auth/account", {
      body: { currentPassword: user1Pass, name: "Hacker" },
    });
    assert.equal(unauthPatch.status, 401, "Unauth /auth/account should return 401");

    const unauthChangePass = await api("POST", "/auth/change-password", {
      body: { currentPassword: user1Pass, newPassword: "NewSecret123!" },
    });
    assert.equal(unauthChangePass.status, 401, "Unauth /auth/change-password should return 401");
    console.log("✓ Edge Case 1 Passed: Unauthenticated requests correctly return 401");

    // --- EDGE CASE 2: Incorrect Current Password ---
    console.log("\n[Edge Case 2] Incorrect current password rejection");
    const wrongPassRes = await api("PATCH", "/auth/account", {
      token: u1Token,
      body: {
        currentPassword: "WrongPassword999!",
        name: "New Name Attempt",
      },
    });
    assert.equal(wrongPassRes.status, 403, "Wrong current password must return 403 Forbidden");

    const wrongPassChange = await api("POST", "/auth/change-password", {
      token: u1Token,
      body: {
        currentPassword: "WrongPassword999!",
        newPassword: "ValidNewPass123!",
      },
    });
    assert.equal(wrongPassChange.status, 403, "Wrong current password for change-password must return 403");
    console.log("✓ Edge Case 2 Passed: Wrong current password correctly returns 403");

    // --- EDGE CASE 3: Empty / No Changes Payload ---
    console.log("\n[Edge Case 3] Empty / no changes payload rejection");
    const emptyBodyRes = await api("PATCH", "/auth/account", {
      token: u1Token,
      body: {
        currentPassword: user1Pass,
      },
    });
    assert.equal(emptyBodyRes.status, 400, "Empty update payload must return 400 Bad Request");

    const sameValuesRes = await api("PATCH", "/auth/account", {
      token: u1Token,
      body: {
        currentPassword: user1Pass,
        name: "Test Account User 1",
        email: testUser1Email,
      },
    });
    assert.equal(sameValuesRes.status, 400, "No changes (identical name and email) must return 400 Bad Request");
    console.log("✓ Edge Case 3 Passed: Empty / identical changes correctly rejected with 400");

    // --- EDGE CASE 4: Duplicate Email Conflict ---
    console.log("\n[Edge Case 4] Email collision / duplicate rejection");
    const duplicateEmailRes = await api("PATCH", "/auth/account", {
      token: u1Token,
      body: {
        currentPassword: user1Pass,
        email: testUser2Email, // Already in use by User 2
      },
    });
    assert.equal(duplicateEmailRes.status, 400, "Duplicate email update must return 400 Bad Request");
    console.log("✓ Edge Case 4 Passed: Duplicate email correctly rejected with 400");

    // --- EDGE CASE 5: Invalid Password Length ---
    console.log("\n[Edge Case 5] Short password validation (< 8 chars)");
    const shortPassRes = await api("PATCH", "/auth/account", {
      token: u1Token,
      body: {
        currentPassword: user1Pass,
        newPassword: "short",
      },
    });
    assert.equal(shortPassRes.status, 400, "Short password (<8 chars) must return 400 Bad Request");
    console.log("✓ Edge Case 5 Passed: Short password correctly rejected");

    // --- EDGE CASE 6: Password Uniqueness Across Desk Users ---
    console.log("\n[Edge Case 6] Password reuse across active users rejection");
    const reusedPassRes = await api("PATCH", "/auth/account", {
      token: u1Token,
      body: {
        currentPassword: user1Pass,
        newPassword: user2Pass, // Already used by User 2
      },
    });
    assert.equal(reusedPassRes.status, 400, "Reused desk password must return 400 Bad Request");
    console.log("✓ Edge Case 6 Passed: Reused desk password correctly rejected with 400");

    // --- EDGE CASE 7: Update Name Only ---
    console.log("\n[Edge Case 7] Update name only");
    const updatedName = "Updated User 1 Name";
    const nameUpdateRes = await api<{ user: { name: string; email: string }; token: string }>(
      "PATCH",
      "/auth/account",
      {
        token: u1Token,
        body: {
          currentPassword: user1Pass,
          name: updatedName,
        },
      },
    );
    assert.equal(nameUpdateRes.status, 200, "Name update should succeed");
    assert.equal(nameUpdateRes.data.user.name, updatedName);
    u1Token = nameUpdateRes.data.token;

    const meAfterName = await api<{ name: string }>("GET", "/auth/me", { token: u1Token });
    assert.equal(meAfterName.data.name, updatedName);
    console.log("✓ Edge Case 7 Passed: Name updated and reflected in /auth/me");

    // --- EDGE CASE 8: Update Email Only ---
    console.log("\n[Edge Case 8] Update email only");
    const updatedEmail = `test-acc1-new-${stamp}@example.com`;
    const emailUpdateRes = await api<{ user: { name: string; email: string }; token: string }>(
      "PATCH",
      "/auth/account",
      {
        token: u1Token,
        body: {
          currentPassword: user1Pass,
          email: updatedEmail,
        },
      },
    );
    assert.equal(emailUpdateRes.status, 200, "Email update should succeed");
    assert.equal(emailUpdateRes.data.user.email, updatedEmail);
    u1Token = emailUpdateRes.data.token;

    const meAfterEmail = await api<{ email: string }>("GET", "/auth/me", { token: u1Token });
    assert.equal(meAfterEmail.data.email, updatedEmail);
    console.log("✓ Edge Case 8 Passed: Email updated and reflected in /auth/me");

    // --- EDGE CASE 9: Update Password Only & Token Version Invalidation ---
    console.log("\n[Edge Case 9] Update password & old session token invalidation");
    const oldU1Token = u1Token;
    const newPass1 = `NewSecretPass1_${stamp}!`;

    const passUpdateRes = await api<{ user: { id: string }; token: string }>(
      "PATCH",
      "/auth/account",
      {
        token: u1Token,
        body: {
          currentPassword: user1Pass,
          newPassword: newPass1,
        },
      },
    );
    assert.equal(passUpdateRes.status, 200, "Password update should succeed");
    const newU1Token = passUpdateRes.data.token;

    // Old token must fail (401) because tokenVersion was incremented
    const oldTokenCheck = await api("GET", "/auth/me", { token: oldU1Token });
    assert.equal(oldTokenCheck.status, 401, "Old token must be invalidated after password change");

    // New token must succeed (200)
    const newTokenCheck = await api<{ id: string }>("GET", "/auth/me", { token: newU1Token });
    assert.equal(newTokenCheck.status, 200, "New token must work after password change");

    // Login with new password must succeed
    const newLogin = await api<{ token: string }>("POST", "/auth/login", {
      body: { email: ownerEmail, password: newPass1 },
    });
    assert.equal(newLogin.status, 201, "Login with updated password should succeed");

    // Login with old password must fail (401)
    const oldLogin = await api("POST", "/auth/login", {
      body: { email: ownerEmail, password: user1Pass },
    });
    assert.equal(oldLogin.status, 401, "Login with old password must fail");
    u1Token = newU1Token;
    console.log("✓ Edge Case 9 Passed: Password changed, old JWT invalidated, new login verified");

    // --- EDGE CASE 10: Multi-Field Update (Name + Email + Password Simultaneously) ---
    console.log("\n[Edge Case 10] Simultaneous update of name + email + password");
    const multiName = "Final Multi Name";
    const multiEmail = `test-acc1-multi-${stamp}@example.com`;
    const multiPass = `MultiPassFinal_${stamp}!`;

    const multiRes = await api<{ user: { name: string; email: string }; token: string }>(
      "PATCH",
      "/auth/account",
      {
        token: u1Token,
        body: {
          currentPassword: newPass1,
          name: multiName,
          email: multiEmail,
          newPassword: multiPass,
        },
      },
    );
    assert.equal(multiRes.status, 200, "Simultaneous update must succeed");
    assert.equal(multiRes.data.user.name, multiName);
    assert.equal(multiRes.data.user.email, multiEmail);
    u1Token = multiRes.data.token;

    const meAfterMulti = await api<{ name: string; email: string }>("GET", "/auth/me", { token: u1Token });
    assert.equal(meAfterMulti.data.name, multiName);
    assert.equal(meAfterMulti.data.email, multiEmail);
    console.log("✓ Edge Case 10 Passed: All fields updated simultaneously in a single transaction");

    // --- EDGE CASE 11: Session Revocation (POST /auth/revoke-sessions) ---
    console.log("\n[Edge Case 11] Explicit session revocation");
    const revokeRes = await api<{ ok: boolean }>("POST", "/auth/revoke-sessions", { token: u1Token });
    assert.equal(revokeRes.status, 201, "Revoke sessions should succeed");
    assert.equal(revokeRes.data.ok, true);

    const checkRevoked = await api("GET", "/auth/me", { token: u1Token });
    assert.equal(checkRevoked.status, 401, "Token must be invalidated after revoke-sessions");
    console.log("✓ Edge Case 11 Passed: Session revocation invalidates active token");

    // --- EDGE CASE 12: Inactive / Soft-Deleted User Account Rejection ---
    console.log("\n[Edge Case 12] Inactive user account access rejection");
    // Login again to get a fresh token for User 1
    const freshLogin = await api<{ token: string }>("POST", "/auth/login", {
      body: { email: ownerEmail, password: multiPass },
    });
    assert.equal(freshLogin.status, 201);
    const freshToken = freshLogin.data.token;

    // Deactivate User 1 directly or via admin
    await prisma.user.update({
      where: { id: user1Id },
      data: { isActive: false },
    });

    const deactivatedMe = await api("GET", "/auth/me", { token: freshToken });
    assert.equal(deactivatedMe.status, 401, "Deactivated user must return 401 on /auth/me");

    const deactivatedPatch = await api("PATCH", "/auth/account", {
      token: freshToken,
      body: { currentPassword: multiPass, name: "Zombie Update" },
    });
    assert.equal(deactivatedPatch.status, 401, "Deactivated user must return 401 on /auth/account");
    console.log("✓ Edge Case 12 Passed: Inactive account requests rejected with 401");

    console.log("\n=================================================");
    console.log("🎉 ALL 12 USER ACCOUNT EDGE TESTS PASSED (100%)");
    console.log("=================================================");
  } finally {
    // Cleanup test users
    if (user1Id) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user1Id } });
      await prisma.user.deleteMany({ where: { id: user1Id } });
    }
    if (user2Id) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user2Id } });
      await prisma.user.deleteMany({ where: { id: user2Id } });
    }
    await prisma.$disconnect();
    console.log("✓ Cleanup completed");
  }
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
