-- At most one active StudioResource. Prisma cannot express a partial unique index,
-- so it lives here and in migrations/20260929060000_studio_resource_single_active.
CREATE UNIQUE INDEX IF NOT EXISTS "StudioResource_single_active_idx"
  ON "StudioResource" (("isActive"))
  WHERE "isActive";
