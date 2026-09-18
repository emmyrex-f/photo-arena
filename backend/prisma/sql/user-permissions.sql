-- Project Sanctum: per-admin desk access list. "*" = full access for ADMIN.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "permissions" TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[];

UPDATE "User"
SET "permissions" = ARRAY['*']::TEXT[]
WHERE "role" = 'ADMIN'
  AND (cardinality("permissions") = 0);

UPDATE "User"
SET "permissions" = ARRAY[]::TEXT[]
WHERE "role" IN ('OWNER', 'STAFF');
