-- Database-level backstop for "one session at a time". The application still locks the
-- StudioResource row (resource-lock.ts) and re-checks with slotFits; this rejects any write
-- path that skips that. Prisma cannot express exclusion constraints, so it lives here and in
-- migrations/20260930120000_booking_no_overlap.
--
-- Booking times are "timestamp without time zone" (UTC instants), so tsrange is required:
-- tstzrange over these columns needs a TimeZone-dependent cast and is rejected in an index.
-- The predicate cannot use now(), so every TEMPORARY_HOLD row counts until it is cancelled;
-- lockStudioResource releases expired holds before each booking write.
CREATE EXTENSION IF NOT EXISTS btree_gist;

UPDATE "Booking" b
SET "status" = 'CANCELLED'
WHERE b."status" = 'TEMPORARY_HOLD'
  AND b."holdExpiresAt" < (now() AT TIME ZONE 'UTC')
  AND NOT EXISTS (
    SELECT 1 FROM "Payment" p WHERE p."bookingId" = b."id" AND p."status" = 'SUCCESS'
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Booking_no_overlap') THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT "Booking_no_overlap"
      EXCLUDE USING gist ("resourceId" WITH =, tsrange("startTime", "endTime") WITH &&)
      WHERE ("status" IN ('PENDING', 'CONFIRMED', 'TEMPORARY_HOLD'));
  END IF;
END $$;
