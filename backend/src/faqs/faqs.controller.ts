import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
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
import { PrismaService } from "../prisma/prisma.service";

class CreateFaqDto {
  @IsString()
  @MinLength(1)
  question!: string;

  @IsString()
  @MinLength(1)
  answer!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class UpdateFaqDto {
  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsString()
  answer?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class ReorderDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}

@Controller("admin/faqs")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("content")
export class FaqsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.prisma.faq.findMany({ orderBy: { sortOrder: "asc" } });
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  async create(@Body() body: CreateFaqDto, @CurrentUser() user: AuthUser) {
    const max = await this.prisma.faq.aggregate({ _max: { sortOrder: true } });
    const row = await this.prisma.faq.create({
      data: {
        question: body.question,
        answer: body.answer,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
      },
    });
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "faq.create",
      entity: "faq",
      entityId: row.id,
    });
    return row;
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async update(
    @Param("id") id: string,
    @Body() body: UpdateFaqDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.prisma.faq.update({ where: { id }, data: body });
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "faq.update",
      entity: "faq",
      entityId: id,
      meta: body as object,
    });
    return row;
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.prisma.faq.delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "faq.delete",
      entity: "faq",
      entityId: id,
    });
    return { ok: true as const };
  }

  @Post("reorder")
  @Roles(Role.OWNER, Role.ADMIN)
  async reorder(@Body() body: ReorderDto, @CurrentUser() user: AuthUser) {
    await this.prisma.$transaction(
      body.ids.map((id, index) =>
        this.prisma.faq.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "faq.reorder",
      entity: "faq",
      meta: { ids: body.ids },
    });
    return this.list();
  }
}
