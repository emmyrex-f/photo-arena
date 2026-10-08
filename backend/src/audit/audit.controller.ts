import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Type } from "class-transformer";
import { IsIn, IsString, MaxLength, MinLength } from "class-validator";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { parsePage, parsePageSize, paginate } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { AUDIT_PURGE_PERCENTS } from "./audit-purge.constants";
import { AuditPurgeService } from "./audit-purge.service";

class RequestAuditPurgeDto {
  @Type(() => Number)
  @IsIn([...AUDIT_PURGE_PERCENTS])
  percent!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}

@Controller("admin/audit")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("audit")
export class AuditController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly purge: AuditPurgeService,
  ) {}

  @Get("purge")
  purgeStatus() {
    return this.purge.status();
  }

  @Post("purge")
  requestPurge(@CurrentUser() user: AuthUser, @Body() body: RequestAuditPurgeDto) {
    return this.purge.request(user, body.percent, body.password);
  }

  @Get()
  async list(
    @Query("page") pageRaw?: string,
    @Query("entity") entity?: string,
    @Query("q") q?: string,
  ) {
    const page = parsePage(pageRaw);
    const pageSize = parsePageSize(undefined, 50);
    const where: Prisma.AuditLogWhereInput = {
      ...(entity ? { entity } : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q, mode: "insensitive" } },
              { userEmail: { contains: q, mode: "insensitive" } },
              { entityId: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(items, total, page, pageSize);
  }
}
