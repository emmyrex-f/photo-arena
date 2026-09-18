import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { parsePage, parsePageSize, paginate } from "../common/pagination";
import { toCsv } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";

@Controller("admin/newsletter")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("content")
export class NewsletterController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get("export.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="newsletter.csv"')
  async exportCsv() {
    const rows = await this.prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: "desc" },
    });
    return toCsv([
      ["id", "email", "isActive", "source", "createdAt"],
      ...rows.map((r) => [
        r.id,
        r.email,
        String(r.isActive),
        r.source ?? "",
        r.createdAt.toISOString(),
      ]),
    ]);
  }

  @Get()
  async list(@Query("page") pageRaw?: string) {
    const page = parsePage(pageRaw);
    const pageSize = parsePageSize(undefined, 50);
    const [total, items] = await Promise.all([
      this.prisma.newsletterSubscriber.count(),
      this.prisma.newsletterSubscriber.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.prisma.newsletterSubscriber.delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "newsletter.delete",
      entity: "newsletter",
      entityId: id,
    });
    return { ok: true as const };
  }
}
