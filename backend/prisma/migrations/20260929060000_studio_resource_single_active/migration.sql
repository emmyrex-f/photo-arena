-- Availability and overlap checks are scoped to a single studio resource. A second
-- active row would split those checks and allow two bookings in the same time frame.
CREATE UNIQUE INDEX IF NOT EXISTS "StudioResource_single_active_idx"
  ON "StudioResource" (("isActive"))
  WHERE "isActive";
