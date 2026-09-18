import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { MediaUsageService } from "./media-usage.service";
import {
  MEDIA_USAGE_TYPES,
  assertCanAccessUsageType,
  parseUsageType,
} from "./media-usage.types";

const IDENTIFIER = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

class AttachMediaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(IDENTIFIER)
  mediaId!: string;

  @IsIn([...MEDIA_USAGE_TYPES])
  usageType!: (typeof MEDIA_USAGE_TYPES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(IDENTIFIER)
  entityId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class EntityQueryDto {
  @IsIn([...MEDIA_USAGE_TYPES])
  usageType!: (typeof MEDIA_USAGE_TYPES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(IDENTIFIER)
  entityId!: string;
}

class DetachComboDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(IDENTIFIER)
  mediaId!: string;

  @IsIn([...MEDIA_USAGE_TYPES])
  usageType!: (typeof MEDIA_USAGE_TYPES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(IDENTIFIER)
  entityId!: string;
}

class ReorderUsagesDto {
  @IsIn([...MEDIA_USAGE_TYPES])
  usageType!: (typeof MEDIA_USAGE_TYPES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(IDENTIFIER)
  entityId!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}

@Controller("admin/media-usages")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaUsageController {
  constructor(
    private readonly usages: MediaUsageService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  listForEntity(@Query() query: EntityQueryDto, @CurrentUser() user: AuthUser) {
    assertCanAccessUsageType(user, parseUsageType(query.usageType));
    return this.usages.listMediaForEntity(query.usageType, query.entityId);
  }

  @Get("media/:mediaId/deletion-check")
  @RequirePermission("gallery")
  deletionCheck(@Param("mediaId") mediaId: string) {
    return this.usages.deletionCheck(mediaId);
  }

  @Get("media/:mediaId")
  @RequirePermission("gallery")
  listForMedia(@Param("mediaId") mediaId: string) {
    return this.usages.listUsagesForMedia(mediaId);
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  async attach(@Body() body: AttachMediaDto, @CurrentUser() user: AuthUser) {
    assertCanAccessUsageType(user, parseUsageType(body.usageType));
    const row = await this.usages.attach(body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "media_usage.attach",
      entity: "media_usage",
      entityId: row.id,
      meta: { mediaId: row.mediaId, usageType: row.usageType, entityId: row.entityId },
    });
    return row;
  }

  @Post("reorder")
  @Roles(Role.OWNER, Role.ADMIN)
  async reorder(@Body() body: ReorderUsagesDto, @CurrentUser() user: AuthUser) {
    assertCanAccessUsageType(user, parseUsageType(body.usageType));
    const rows = await this.usages.reorder(body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "media_usage.reorder",
      entity: "media_usage",
      meta: { usageType: body.usageType, entityId: body.entityId, ids: body.ids },
    });
    return rows;
  }

  @Post("detach")
  @Roles(Role.OWNER, Role.ADMIN)
  async detachCombo(@Body() body: DetachComboDto, @CurrentUser() user: AuthUser) {
    assertCanAccessUsageType(user, parseUsageType(body.usageType));
    const row = await this.usages.detach(body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "media_usage.detach",
      entity: "media_usage",
      entityId: row.usage.id,
      meta: {
        mediaId: row.usage.mediaId,
        usageType: row.usage.usageType,
        entityId: row.usage.entityId,
      },
    });
    return { ok: true as const };
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async detachById(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const existing = await this.usages.getById(id);
    assertCanAccessUsageType(user, parseUsageType(existing.usageType));
    const row = await this.usages.detachById(id);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "media_usage.detach",
      entity: "media_usage",
      entityId: row.usage.id,
      meta: {
        mediaId: row.usage.mediaId,
        usageType: row.usage.usageType,
        entityId: row.usage.entityId,
      },
    });
    return { ok: true as const };
  }
}
