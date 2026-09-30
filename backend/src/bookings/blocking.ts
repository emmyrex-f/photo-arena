import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";

/** Statuses that occupy the studio. Expired TEMPORARY_HOLD rows are excluded. */
export function blockingWhere(excludeId?: string): Prisma.BookingWhereInput {
  return {
    ...(excludeId ? { id: { not: excludeId } } : {}),
    OR: [
      { status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
      {
        AND: [
          { status: BookingStatus.TEMPORARY_HOLD },
          { holdExpiresAt: { gt: new Date() } },
        ],
      },
    ],
  };
}

/** Unpaid TEMPORARY_HOLD rows whose hold window has passed. */
export function expiredHoldWhere(): Prisma.BookingWhereInput {
  return {
    status: BookingStatus.TEMPORARY_HOLD,
    holdExpiresAt: { lt: new Date() },
    NOT: { payments: { some: { status: PaymentStatus.SUCCESS } } },
  };
}
