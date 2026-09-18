import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

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
