-- Desk audit purge jobs. One row is queued per request; the API worker deletes AuditLog rows in batches.

CREATE TYPE "AuditPurgeStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

CREATE TABLE "AuditPurge" (
    "id" TEXT NOT NULL,
    "percent" INTEGER NOT NULL,
    "status" "AuditPurgeStatus" NOT NULL DEFAULT 'PENDING',
    "totalAtRequest" INTEGER NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "deletedCount" INTEGER NOT NULL DEFAULT 0,
    "requestedByUserId" TEXT,
    "requestedByEmail" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "AuditPurge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditPurge_status_requestedAt_idx" ON "AuditPurge"("status", "requestedAt");
CREATE INDEX "AuditPurge_finishedAt_idx" ON "AuditPurge"("finishedAt");
