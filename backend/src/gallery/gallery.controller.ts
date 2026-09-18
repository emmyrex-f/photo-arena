import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Role } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
} from "class-validator";
import { memoryStorage } from "multer";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { GalleryService } from "./gallery.service";

class UpdateGalleryDto {
  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/)
  mediaId?: string | null;
}

class ReorderDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

class UploadFieldsDto {
  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  alt?: string;
}

function parseOptionalBoolean(raw?: string): boolean | undefined {
  if (raw === undefined || raw === "") return undefined;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  throw new BadRequestException("Invalid isActive filter");
}

@Controller("admin/gallery")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("gallery")
export class GalleryController {
  constructor(
    private readonly gallery: GalleryService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(
    @Query("kind") kind?: string,
    @Query("isActive") isActiveRaw?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.gallery.list({
      kind,
      isActive: parseOptionalBoolean(isActiveRaw),
      page,
      pageSize,
    });
  }

  @Post("upload")
  @Roles(Role.OWNER, Role.ADMIN)
  @UseInterceptors(
    FilesInterceptor("files", 10, {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: UploadFieldsDto,
    @CurrentUser() user: AuthUser,
  ) {
    const rows = await this.gallery.upload(files, body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "gallery.upload",
      entity: "gallery",
      meta: { count: rows.length, ids: rows.map((r) => r.id) },
    });
    return rows;
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async update(
    @Param("id") id: string,
    @Body() body: UpdateGalleryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.gallery.update(id, body);
    const action =
      body.isActive === true
        ? "gallery.activate"
        : body.isActive === false
          ? "gallery.deactivate"
          : "gallery.update";
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action,
      entity: "gallery",
      entityId: id,
      meta: body as object,
    });
    return row;
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    try {
      const row = await this.gallery.remove(id);
      await this.audit.log({
        userId: user.id,
        userEmail: user.email,
        action: "gallery.delete",
        entity: "gallery",
        entityId: id,
      });
      return row;
    } catch (error) {
      if (error instanceof ConflictException) {
        const payload = error.getResponse();
        await this.audit.log({
          userId: user.id,
          userEmail: user.email,
          action: "gallery.delete_blocked",
          entity: "gallery",
          entityId: id,
          meta: typeof payload === "object" && payload !== null ? (payload as object) : { message: String(payload) },
        });
      }
      throw error;
    }
  }

  @Post("reorder")
  @Roles(Role.OWNER, Role.ADMIN)
  async reorder(@Body() body: ReorderDto, @CurrentUser() user: AuthUser) {
    const rows = await this.gallery.reorder(body.ids);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "gallery.reorder",
      entity: "gallery",
      meta: { ids: body.ids },
    });
    return rows;
  }
}
