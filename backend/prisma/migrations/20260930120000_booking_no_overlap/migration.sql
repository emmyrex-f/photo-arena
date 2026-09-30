-- Supersedes the no-op 20260917140000_booking_overlap_exclude: tsrange (not tstzrange) works
-- because Booking times are "timestamp without time zone". Kept in sync with
-- prisma/sql/booking-overlap-exclude.sql. Fails loudly if active bookings already overlap.
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
