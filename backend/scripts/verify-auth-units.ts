/**
 * Offline unit checks for AUTH-1..AUTH-3 permission helpers.
 * Run: npx tsx scripts/verify-auth-units.ts
 */
import assert from "node:assert/strict";
import { Role } from "@prisma/client";
import {
  hasDeskPermission,
  resolveDeskPermissions,
  FULL_ACCESS,
} from "../src/auth/permissions";
import { toAuthUser } from "../src/auth/auth.types";

function run() {
  assert.deepEqual(resolveDeskPermissions({ role: Role.OWNER }), [FULL_ACCESS]);
  assert.deepEqual(
    resolveDeskPermissions({ role: Role.ADMIN, fullAccess: true }),
    [FULL_ACCESS],
  );
  assert.deepEqual(
    resolveDeskPermissions({
      role: Role.ADMIN,
      fullAccess: false,
      permissions: ["bookings", "payments", "not-a-perm"],
    }),
    ["bookings", "payments"],
  );
  assert.deepEqual(
    resolveDeskPermissions({ role: Role.ADMIN, fullAccess: false, permissions: [] }),
    [],
  );
  assert.deepEqual(
    resolveDeskPermissions({
      role: Role.STAFF,
      permissions: ["customers", "customers"],
    }),
    ["customers"],
  );
  assert.deepEqual(resolveDeskPermissions({ role: Role.STAFF }), []);

  const owner = toAuthUser({
    id: "1",
    email: "o@x.com",
    name: "O",
    role: Role.OWNER,
    permissions: [],
  });
  assert.deepEqual(owner.permissions, [FULL_ACCESS]);
  assert.equal(hasDeskPermission(owner, "users"), true);

  const admin = toAuthUser({
    id: "2",
    email: "a@x.com",
    name: "A",
    role: Role.ADMIN,
    permissions: ["bookings"],
  });
  assert.equal(hasDeskPermission(admin, "bookings"), true);
  assert.equal(hasDeskPermission(admin, "payments"), false);

  const staffEmpty = toAuthUser({
    id: "3",
    email: "s@x.com",
    name: "S",
    role: Role.STAFF,
    permissions: [],
  });
  assert.equal(hasDeskPermission(staffEmpty, "dashboard"), false);

  const staffFull = toAuthUser({
    id: "4",
    email: "sf@x.com",
    name: "SF",
    role: Role.STAFF,
    permissions: [FULL_ACCESS],
  });
  assert.equal(hasDeskPermission(staffFull, "dashboard"), true);

  // Missing permissions on ADMIN must not become full access
  const adminMissing = toAuthUser({
    id: "5",
    email: "m@x.com",
    name: "M",
    role: Role.ADMIN,
  });
  assert.deepEqual(adminMissing.permissions, []);
  assert.equal(hasDeskPermission(adminMissing, "dashboard"), false);

  console.log("AUTH unit checks passed (resolveDeskPermissions, hasDeskPermission, toAuthUser)");
}

run();
