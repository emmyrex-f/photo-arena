import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { IsArray, IsEmail, IsOptional, IsString, MaxLength } from "class-validator";
import { Role } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CustomersService } from "./customers.service";

class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

@Controller("admin/customers")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("customers")
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly audit: AuditService,
  ) {}

  @Get("export.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="customers.csv"')
  exportCsv() {
    return this.customers.exportCsv();
  }

  @Get()
  list(
    @Query("q") q?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("tag") tag?: string,
  ) {
    return this.customers.list(q, page, pageSize, tag);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.customers.get(id);
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async update(
    @Param("id") id: string,
    @Body() body: UpdateCustomerDto,
    @CurrentUser() user: AuthUser,
  ) {
    const customer = await this.customers.update(id, body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "customer.update",
      entity: "customer",
      entityId: id,
      meta: body as object,
    });
    return customer;
  }
}
