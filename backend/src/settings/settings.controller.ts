import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import type { Request } from "express";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PrismaService } from "../prisma/prisma.service";

const SETTINGS_KEY_PREFIXES = [
  "site.",
  "social.",
  "hero.",
  "tour.",
  "cta.",
  "about.",
  "instagram.",
  "analytics.",
  "seo.",
  "policies.",
  "notifications.",
];

function isAllowedSettingKey(key: string): boolean {
  return SETTINGS_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

@Controller("admin/settings")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("content")
export class SettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async get() {
    const rows = await this.prisma.businessSettings.findMany({ orderBy: { key: "asc" } });
    return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
  }

  @Put()
  @Roles(Role.OWNER, Role.ADMIN)
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
  async put(@Req() req: Request, @CurrentUser() user: AuthUser) {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const entries = Object.entries(body).filter(
      (pair): pair is [string, string] =>
        typeof pair[0] === "string" &&
        typeof pair[1] === "string" &&
        isAllowedSettingKey(pair[0]) &&
        pair[0].length <= 120 &&
        pair[1].length <= 20_000,
    );
    for (const [key, raw] of entries) {
      const value = key.startsWith("site.hours.") ? raw.trim().replace(/[.\s]+$/g, "") : raw;
      await this.prisma.businessSettings.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "settings.update",
      entity: "settings",
      meta: { keys: entries.map(([k]) => k) },
    });
    return this.get();
  }
}
