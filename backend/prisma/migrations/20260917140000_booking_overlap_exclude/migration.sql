-- H5 exclusion is not applied: timestamptz ranges are not IMMUTABLE in PostgreSQL GiST indexes.
-- Overlap safety is SELECT ... FOR UPDATE on StudioResource (resource-lock.ts) + slotFits.
SELECT 1;
