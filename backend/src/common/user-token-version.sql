-- Safe additive column for JWT invalidation (H2). Repeatable.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
