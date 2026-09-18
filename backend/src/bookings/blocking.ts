import { BookingStatus, Prisma } from "@prisma/client";

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
