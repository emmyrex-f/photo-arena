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
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UsersService } from "./users.service";

class CreateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(Role)
  role!: Role;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsBoolean()
  fullAccess?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  fullAccess?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  password!: string;
}

@Controller("admin/users")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("users")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  list() {
    return this.users.list();
  }

  @Post()
  @Roles(Role.OWNER)
  async create(@Body() body: CreateUserDto, @CurrentUser() user: AuthUser) {
    const row = await this.users.create(body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "user.create",
      entity: "user",
      entityId: row.id,
      meta: { email: row.email, role: row.role },
    });
    return row;
  }

  @Patch(":id")
  @Roles(Role.OWNER)
  async update(
    @Param("id") id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.users.update(id, user.id, body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "user.update",
      entity: "user",
      entityId: id,
      meta: body as object,
    });
    return row;
  }

  @Post(":id/reset-password")
  @Roles(Role.OWNER)
  async resetPassword(
    @Param("id") id: string,
    @Body() body: ResetPasswordDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.users.resetPassword(id, body.password);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "user.reset_password",
      entity: "user",
      entityId: id,
    });
    return row;
  }

  @Delete(":id")
  @Roles(Role.OWNER)
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    const row = await this.users.remove(id, user.id);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "user.delete",
      entity: "user",
      entityId: id,
    });
    return row;
  }
}
