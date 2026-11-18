ALTER TABLE "Service" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;

-- Home preview set. Other services stay off the home query.
UPDATE "Service"
SET "featured" = true
WHERE "slug" IN ('personal-birthday', 'bundle-of-joy-0-1', 'pre-wedding', 'space-rental');

CREATE INDEX "Service_isActive_featured_sortOrder_idx" ON "Service"("isActive", "featured", "sortOrder");
