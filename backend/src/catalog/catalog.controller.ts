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
import { Role, ServiceKind } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CatalogService } from "./catalog.service";

function nullableInt({ value }: { value: unknown }): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return Number(value);
}

class CreateServiceDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsEnum(ServiceKind)
  kind?: ServiceKind;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  startingPriceKobo!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isProvisional?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/)
  mediaId?: string | null;
}

class UpdateServiceDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(ServiceKind)
  kind?: ServiceKind;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  startingPriceKobo?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isProvisional?: boolean;

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

class CreatePackageDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  durationMinutes!: number;

  @IsOptional()
  @Transform(nullableInt)
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  outfitCount?: number | null;

  @IsOptional()
  @Transform(nullableInt)
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  backdropCount?: number | null;

  @IsOptional()
  @Transform(nullableInt)
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  editedPhotoCount?: number | null;

  @IsOptional()
  @IsString()
  includes?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceKobo!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isProvisional?: boolean;
}

class UpdatePackageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  durationMinutes?: number;

  @IsOptional()
  @Transform(nullableInt)
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  outfitCount?: number | null;

  @IsOptional()
  @Transform(nullableInt)
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  backdropCount?: number | null;

  @IsOptional()
  @Transform(nullableInt)
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  editedPhotoCount?: number | null;

  @IsOptional()
  @IsString()
  includes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceKobo?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isProvisional?: boolean;
}

class UpdatePricingRuleDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5000)
  bps?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("services")
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly audit: AuditService,
  ) {}

  @Get("services")
  listServices() {
    return this.catalog.listServices();
  }

  @Post("services")
  @Roles(Role.OWNER, Role.ADMIN)
  async createService(@Body() body: CreateServiceDto, @CurrentUser() user: AuthUser) {
    const row = await this.catalog.createService(body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "service.create",
      entity: "service",
      entityId: row.id,
      meta: { name: row.name, mediaId: body.mediaId ?? null },
    });
    return row;
  }

  @Post("services/reorder")
  @Roles(Role.OWNER, Role.ADMIN)
  async reorderServices(@Body() body: ReorderDto, @CurrentUser() user: AuthUser) {
    const rows = await this.catalog.reorderServices(body.ids);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "service.reorder",
      entity: "service",
      meta: { ids: body.ids },
    });
    return rows;
  }

  @Patch("services/:id")
  @Roles(Role.OWNER, Role.ADMIN)
  async updateService(
    @Param("id") id: string,
    @Body() body: UpdateServiceDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.catalog.updateService(id, body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "service.update",
      entity: "service",
      entityId: id,
      meta: body as object,
    });
    return row;
  }

  @Delete("services/:id")
  @Roles(Role.OWNER, Role.ADMIN)
  async deleteService(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const row = await this.catalog.deleteService(id);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "service.delete",
      entity: "service",
      entityId: id,
    });
    return row;
  }

  @Post("services/:id/packages")
  @Roles(Role.OWNER, Role.ADMIN)
  async createPackage(
    @Param("id") id: string,
    @Body() body: CreatePackageDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.catalog.createPackage(id, body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "package.create",
      entity: "package",
      entityId: row.id,
      meta: { serviceId: id, name: row.name },
    });
    return row;
  }

  @Patch("packages/:id")
  @Roles(Role.OWNER, Role.ADMIN)
  async updatePackage(
    @Param("id") id: string,
    @Body() body: UpdatePackageDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.catalog.updatePackage(id, body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "package.update",
      entity: "package",
      entityId: id,
      meta: body as object,
    });
    return row;
  }

  @Delete("packages/:id")
  @Roles(Role.OWNER, Role.ADMIN)
  async deletePackage(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const row = await this.catalog.deletePackage(id);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "package.delete",
      entity: "package",
      entityId: id,
    });
    return row;
  }

  @Post("packages/reorder")
  @Roles(Role.OWNER, Role.ADMIN)
  async reorderPackages(@Body() body: ReorderDto, @CurrentUser() user: AuthUser) {
    const rows = await this.catalog.reorderPackages(body.ids);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "package.reorder",
      entity: "package",
      meta: { ids: body.ids },
    });
    return rows;
  }

  @Get("pricing-rules")
  listPricingRules() {
    return this.catalog.listPricingRules();
  }

  @Patch("pricing-rules/:key")
  @Roles(Role.OWNER, Role.ADMIN)
  async updatePricingRule(
    @Param("key") key: string,
    @Body() body: UpdatePricingRuleDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.catalog.updatePricingRule(key, body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "pricing_rule.update",
      entity: "pricing_rule",
      entityId: key,
      meta: body as object,
    });
    return row;
  }
}
