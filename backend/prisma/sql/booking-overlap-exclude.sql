-- H5: PostgreSQL rejects tstzrange / timestamptz expressions in GiST indexes
-- (not IMMUTABLE — they depend on TimeZone). Photo Arena stores UTC instants as DateTime.
-- Concurrency authority is SELECT ... FOR UPDATE on StudioResource inside booking/payment
-- transactions (see backend/src/bookings/resource-lock.ts), plus slotFits.
-- This file is kept as documentation; do not apply as a migration.
SELECT 1;
