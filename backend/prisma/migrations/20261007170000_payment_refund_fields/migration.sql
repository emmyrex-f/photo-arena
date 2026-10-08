-- Refund columns and statuses used by the payments desk. Existing rows stay unrefunded.

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';

ALTER TABLE "Payment" ADD COLUMN "refundedAmountKobo" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "refundReason" TEXT;
ALTER TABLE "Payment" ADD COLUMN "channel" TEXT;
ALTER TABLE "Payment" ADD COLUMN "refundedAt" TIMESTAMP(3);
