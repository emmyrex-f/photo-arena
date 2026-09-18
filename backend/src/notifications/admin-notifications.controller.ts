import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { IsArray, IsBoolean, IsEmail } from "class-validator";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { parsePage, parsePageSize, paginate } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "./notifications.service";

class UpdateNotificationSettingsDto {
  @IsArray()
  @IsEmail({}, { each: true })
  recipients!: string[];

  @IsBoolean()
  reminder24h!: boolean;

  @IsBoolean()
  reminder2h!: boolean;
}

@Controller("admin/notifications")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("notifications")
export class AdminNotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get("settings")
  async settings() {
    const recipients = await this.notifications.getRecipients();
    const rows = await this.prisma.businessSettings.findMany({
      where: { key: { in: ["notifications.reminder24h", "notifications.reminder2h"] } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      recipients,
      reminder24h: (map["notifications.reminder24h"] ?? "true") === "true",
      reminder2h: (map["notifications.reminder2h"] ?? "true") === "true",
      smtpConfigured: this.notifications.smtpConfigured(),
      fromAddress: this.notifications.fromAddress(),
    };
  }

  @Put("settings")
  @Roles(Role.OWNER, Role.ADMIN)
  async updateSettings(
    @Body() body: UpdateNotificationSettingsDto,
    @CurrentUser() user: AuthUser,
  ) {
    const pairs: Array<[string, string]> = [
      ["notifications.recipients", body.recipients.join(",")],
      ["notifications.reminder24h", String(body.reminder24h)],
      ["notifications.reminder2h", String(body.reminder2h)],
    ];
    for (const [key, value] of pairs) {
      await this.prisma.businessSettings.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "notifications.settings",
      entity: "settings",
      meta: { recipients: body.recipients.length, reminder24h: body.reminder24h, reminder2h: body.reminder2h },
    });
    return this.settings();
  }

  @Get("logs")
  async logs(@Query("page") pageRaw?: string) {
    const page = parsePage(pageRaw);
    const pageSize = parsePageSize(undefined, 50);
    const [total, items] = await Promise.all([
      this.prisma.notificationLog.count(),
      this.prisma.notificationLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  @Post("test")
  @Roles(Role.OWNER, Role.ADMIN)
  async test(@CurrentUser() user: AuthUser) {
    await this.notifications.notifyEvent("booking_confirmed", {
      customerName: "Test Recipient",
      reference: "TEST",
      startTime: new Date().toISOString(),
      details: `Test email triggered by ${user.email}`,
    });
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "notifications.test",
      entity: "notification",
    });
    return { ok: true as const };
  }

  @Get("templates")
  templates() {
    return this.notifications.templates();
  }
}
