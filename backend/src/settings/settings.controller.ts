import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Role } from "@prisma/client";
import { IsIn } from "class-validator";
import type { Request } from "express";
import { promises as fs } from "fs";
import { memoryStorage } from "multer";
import { join } from "path";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { assertInsideUploads } from "../common/upload-path";
import { ensureUploadsDir, uploadsRoot } from "../common/utils";
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
  "services.",
];

function isAllowedSettingKey(key: string): boolean {
  return SETTINGS_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

const PAGE_VIDEO_SLOTS = ["hero", "tour"] as const;
type PageVideoSlot = (typeof PAGE_VIDEO_SLOTS)[number];
const PAGE_VIDEO_EXTS = [".mp4", ".webm", ".mov", ".ogg", ".ogv"];

class PageVideoDto {
  @IsIn(PAGE_VIDEO_SLOTS)
  slot!: PageVideoSlot;
}

function pageVideoExt(file: Express.Multer.File): string {
  const name = file.originalname.toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();
  if (mime === "video/webm" || name.endsWith(".webm")) return ".webm";
  if (mime === "video/quicktime" || name.endsWith(".mov")) return ".mov";
  if (mime === "video/ogg" || name.endsWith(".ogv") || name.endsWith(".ogg")) return ".ogg";
  if (mime === "video/mp4" || name.endsWith(".mp4")) return ".mp4";
  throw new BadRequestException("Upload an MP4, WebM, or MOV video");
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

  /** Hero and studio-tour clips stay on those sections. They are not media-library items. */
  @Post("page-video")
  @Roles(Role.OWNER, Role.ADMIN)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async uploadPageVideo(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: PageVideoDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException("Choose a video file");
    const ext = pageVideoExt(file);
    ensureUploadsDir();
    const dir = assertInsideUploads(join(uploadsRoot(), "page"));
    await fs.mkdir(dir, { recursive: true });
    for (const oldExt of PAGE_VIDEO_EXTS) {
      if (oldExt === ext) continue;
      await fs.unlink(join(dir, `${body.slot}${oldExt}`)).catch(() => undefined);
    }
    const filename = `${body.slot}${ext}`;
    await fs.writeFile(assertInsideUploads(join(dir, filename)), file.buffer);
    const url = `/uploads/page/${filename}?v=${Date.now()}`;
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "settings.page-video",
      entity: "settings",
      meta: { slot: body.slot },
    });
    return { url };
  }
}
