import { ConflictException } from "@nestjs/common";
import { BookingStatus, Prisma } from "@prisma/client";
import { expiredHoldWhere } from "./blocking";

export async function lockStudioResource(
  tx: Prisma.TransactionClient,
  resourceId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "StudioResource" WHERE id = ${resourceId} FOR UPDATE
  `;
  if (!rows.length) {
    throw new ConflictException("That slot is not available");
  }
  // The Booking_no_overlap exclusion constraint counts every TEMPORARY_HOLD row (it cannot
  // compare against now()), so expired holds must be released before any write on this resource.
  await tx.booking.updateMany({
    where: { resourceId, ...expiredHoldWhere() },
    data: { status: BookingStatus.CANCELLED },
  });
}

export function isOverlapConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: string }).code) : "";
  if (code === "23P01") return true;
  const text = error instanceof Error ? error.message : String(error);
  return /23P01|exclusion constraint|conflicting key value|overlapping/i.test(text);
}

export function throwIfOverlap(error: unknown): never {
  if (isOverlapConstraintError(error)) {
    throw new ConflictException("That slot is not available");
  }
  throw error;
}
