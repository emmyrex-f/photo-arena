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
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { TestimonialsService } from "./testimonials.service";

class CreateTestimonialDto {
  @IsString()
  @MinLength(1)
  quote!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

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

class UpdateTestimonialDto {
  @IsOptional()
  @IsString()
  quote?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

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

@Controller("admin/testimonials")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("testimonials")
export class TestimonialsController {
  constructor(
    private readonly testimonials: TestimonialsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list() {
    return this.testimonials.list();
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  async create(@Body() body: CreateTestimonialDto, @CurrentUser() user: AuthUser) {
    const row = await this.testimonials.create(body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "testimonial.create",
      entity: "testimonial",
      entityId: row.id,
    });
    return row;
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async update(
    @Param("id") id: string,
    @Body() body: UpdateTestimonialDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.testimonials.update(id, body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "testimonial.update",
      entity: "testimonial",
      entityId: id,
      meta: body as object,
    });
    return row;
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.testimonials.remove(id);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "testimonial.delete",
      entity: "testimonial",
      entityId: id,
    });
    return { ok: true as const };
  }

  @Post("reorder")
  @Roles(Role.OWNER, Role.ADMIN)
  async reorder(@Body() body: ReorderDto, @CurrentUser() user: AuthUser) {
    const rows = await this.testimonials.reorder(body.ids);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "testimonial.reorder",
      entity: "testimonial",
      meta: { ids: body.ids },
    });
    return rows;
  }
}
