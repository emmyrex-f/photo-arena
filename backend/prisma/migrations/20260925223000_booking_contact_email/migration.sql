-- Enforce contact email per booking + required customer email (reminders).
-- Backfill booking.contactEmail from the linked customer profile; never invent addresses.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;

UPDATE "Booking" AS b
SET "contactEmail" = LOWER(TRIM(c."email"))
FROM "Customer" AS c
WHERE b."customerId" = c.id
  AND (b."contactEmail" IS NULL OR b."contactEmail" = '')
  AND c."email" IS NOT NULL
  AND TRIM(c."email") <> '';

-- Fail closed if any booking still lacks an email (should be zero after backfill).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Booking" WHERE "contactEmail" IS NULL OR TRIM("contactEmail") = '') THEN
    RAISE EXCEPTION 'Cannot enforce Booking.contactEmail NOT NULL: some bookings have no customer email to backfill';
  END IF;
  IF EXISTS (SELECT 1 FROM "Customer" WHERE "email" IS NULL OR TRIM("email") = '') THEN
    RAISE EXCEPTION 'Cannot enforce Customer.email NOT NULL: some customers are missing email';
  END IF;
END $$;

ALTER TABLE "Booking" ALTER COLUMN "contactEmail" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "email" SET NOT NULL;
