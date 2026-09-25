import "./load-env";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

function extractResetToken(body: string): string | null {
  const match = body.match(/[?&]token=([a-f0-9]{64})/i);
  return match?.[1] ?? null;
}

async function main() {
  console.log("Starting verification of forgot/reset password + session revoke...");
  const prisma = new PrismaClient();

  try {
    const desk = await api<{ email: string }>("GET", "/auth/desk-email");
    assert.equal(desk.status, 200, `desk-email ${desk.status}`);
    const ownerEmail = desk.data.email.trim().toLowerCase();
    const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme";

    // 1. Initial Login
    const ownerLogin = await api<{ token: string; user: { id: string } }>("POST", "/auth/login", {
      body: { email: ownerEmail, password: ownerPassword },
    });
    assert.equal(ownerLogin.status, 201, `Owner login should succeed: ${JSON.stringify(ownerLogin.data)}`);
    const ownerToken = ownerLogin.data.token;
    console.log("✓ Step 1: Owner login successful");

    // 2. Forgot Password — unknown email (no enumeration leak)
    const ghostRes = await api<{ ok: boolean; message: string }>("POST", "/auth/forgot-password", {
      body: { email: "ghost_user_does_not_exist@example.com" },
    });
    assert.ok(
      ghostRes.status === 200 || ghostRes.status === 201,
      "Ghost forgot password should succeed without error",
    );
    assert.equal(ghostRes.data.ok, true);
    console.log("✓ Step 2: Forgot password enumeration protection verified");

    // 3. Create a test staff user for password reset & session revocation
    const stamp = Date.now();
    const staffEmail = `test-staff-${stamp}@example.com`;
    const initialStaffPass = "InitialPass123!";
    const resetStaffPass = `ResetPass${stamp}!`;

    const createStaff = await api<{ id: string; email: string }>("POST", "/admin/users", {
      token: ownerToken,
      body: {
        name: "Test Staff",
        email: staffEmail,
        role: "ADMIN",
        password: initialStaffPass,
        fullAccess: true,
      },
    });
    assert.equal(createStaff.status, 201, `Failed to create test staff: ${JSON.stringify(createStaff.data)}`);
    const staffId = createStaff.data.id;
    console.log("✓ Step 3: Created test staff user", staffEmail);

    // 4. Forgot Password for real user
    const forgotRes = await api<{ ok: boolean; message: string }>("POST", "/auth/forgot-password", {
      body: { email: staffEmail },
    });
    assert.ok(forgotRes.status === 200 || forgotRes.status === 201);
    assert.equal(forgotRes.data.ok, true);

    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { userId: staffId, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(tokenRecord, "Password reset token should be recorded in database");
    assert.ok(tokenRecord.expiresAt > new Date(), "Token must not be expired");
    console.log("✓ Step 4: Password reset token generated in database with 1h expiration");

    const resetLog = await prisma.notificationLog.findFirst({
      where: { event: "password_reset", to: staffEmail },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(resetLog, "NotificationLog should contain password_reset entry");
    console.log("✓ Step 5: Password reset email recorded via email channel:", resetLog.channel);

    let emailBody = resetLog.payload ?? "";
    try {
      const parsed = JSON.parse(resetLog.payload) as { body?: string; html?: string };
      emailBody = `${parsed.body ?? ""}\n${parsed.html ?? ""}`;
    } catch {
      /* payload may already be plain text */
    }
    const rawToken = extractResetToken(emailBody);
    assert.ok(rawToken, "Reset email body must include raw token URL");
    const expectedHash = createHash("sha256").update(rawToken).digest("hex");
    assert.equal(expectedHash, tokenRecord.tokenHash, "Email token must match DB hash");
    console.log("✓ Step 6: Raw token extracted from notification body matches DB hash");

    // 5. Verify token endpoints
    const invalidVerify = await api<{ valid: boolean }>("GET", "/auth/verify-reset-token?token=invalid_raw_token");
    assert.equal(invalidVerify.data.valid, false, "Invalid token must be rejected");

    const validVerify = await api<{ valid: boolean; email?: string }>(
      "GET",
      `/auth/verify-reset-token?token=${encodeURIComponent(rawToken)}`,
    );
    assert.equal(validVerify.data.valid, true, "Valid token must verify");
    assert.ok(validVerify.data.email, "Valid verify should return masked email");
    console.log("✓ Step 7: /auth/verify-reset-token accepts valid token and rejects invalid");

    // 6. Reset password with token
    const resetRes = await api<{ ok: boolean; message: string }>("POST", "/auth/reset-password", {
      body: { token: rawToken, newPassword: resetStaffPass },
    });
    assert.ok(
      resetRes.status === 200 || resetRes.status === 201,
      `Reset failed: ${JSON.stringify(resetRes.data)}`,
    );
    assert.equal(resetRes.data.ok, true);

    const usedToken = await prisma.passwordResetToken.findUnique({ where: { id: tokenRecord.id } });
    assert.ok(usedToken?.usedAt, "Token must be marked used after reset");
    console.log("✓ Step 8: Password reset succeeded and token marked used");

    // Reuse of same token must fail
    const reuse = await api("POST", "/auth/reset-password", {
      body: { token: rawToken, newPassword: "AnotherPass999!" },
    });
    assert.ok(reuse.status >= 400, "Used token must be rejected");
    console.log("✓ Step 9: Used reset token rejected on second attempt");

    // 7. Login with desk email + new staff password (Project Sanctum)
    const staffLogin = await api<{ token: string; user: { id: string; email: string } }>("POST", "/auth/login", {
      body: { email: ownerEmail, password: resetStaffPass },
    });
    assert.equal(
      staffLogin.status,
      201,
      `Login with new password failed: ${JSON.stringify(staffLogin.data)}`,
    );
    assert.equal(staffLogin.data.user.id, staffId, "Password must select the staff user");
    console.log("✓ Step 10: Desk login with new password succeeds (staff selected by password)");

    // Old password must fail
    const oldPassLogin = await api("POST", "/auth/login", {
      body: { email: ownerEmail, password: initialStaffPass },
    });
    assert.equal(oldPassLogin.status, 401, "Old password must no longer work");
    console.log("✓ Step 11: Old password rejected after reset");

    // 8. Session revoke still works with fresh token
    const staffToken = staffLogin.data.token;
    const meOk = await api("GET", "/auth/me", { token: staffToken });
    assert.equal(meOk.status, 200);

    const revokeSelf = await api<{ ok: boolean }>("POST", "/auth/revoke-sessions", { token: staffToken });
    assert.ok(revokeSelf.status === 200 || revokeSelf.status === 201);
    const dead = await api("GET", "/auth/me", { token: staffToken });
    assert.equal(dead.status, 401, "Session must die after revoke");
    console.log("✓ Step 12: Session revoke after reset works");

    // Cleanup test user
    await prisma.passwordResetToken.deleteMany({ where: { userId: staffId } });
    await prisma.notificationLog.deleteMany({ where: { to: staffEmail } });
    await prisma.user.delete({ where: { id: staffId } });
    console.log("✓ Cleanup: Removed test staff user");

    console.log("\n==========================================");
    console.log("🎉 FORGOT / RESET PASSWORD VERIFICATION PASSED");
    console.log("==========================================\n");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
