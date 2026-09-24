-- Project Sanctum: per-admin desk access list. "*" = full access for ADMIN/STAFF.
-- Default empty so omitted permissions never grant full desk by schema default.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "User"
  ALTER COLUMN "permissions" SET DEFAULT ARRAY[]::TEXT[];

UPDATE "User"
SET "permissions" = ARRAY['*']::TEXT[]
WHERE "role" = 'OWNER'
  AND (cardinality("permissions") = 0 OR NOT ("*" = ANY ("permissions")));

UPDATE "User"
SET "permissions" = ARRAY[]::TEXT[]
WHERE "role" = 'STAFF'
  AND "permissions" = ARRAY['*']::TEXT[];
