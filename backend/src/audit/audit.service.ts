import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async log(input: {
    userId?: string | null;
    userEmail: string;
    action: string;
    entity: string;
    entityId?: string | null;
    meta?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        userEmail: input.userEmail,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        meta: input.meta ?? undefined,
      },
    });
  }
}
