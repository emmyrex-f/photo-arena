import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { EnquiryStatus, Role } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { AuditService } from "../audit/audit.service";
import type { AuthUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RequirePermission } from "../auth/permissions.decorator";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { EnquiriesService } from "./enquiries.service";

class UpdateEnquiryDto {
  @IsOptional()
  @IsEnum(EnquiryStatus)
  status?: EnquiryStatus;

  @IsOptional()
  @IsString()
  internalNote?: string;
}

@Controller("admin/enquiries")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("enquiries")
export class EnquiriesController {
  constructor(
    private readonly enquiries: EnquiriesService,
    private readonly audit: AuditService,
  ) {}

  @Get("summary")
  summary() {
    return this.enquiries.summary();
  }

  @Get()
  list(
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("q") q?: string,
  ) {
    return this.enquiries.list(status, page, pageSize, q);
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.enquiries.get(id);
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async update(
    @Param("id") id: string,
    @Body() body: UpdateEnquiryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.enquiries.update(id, body);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "enquiry.update",
      entity: "enquiry",
      entityId: id,
      meta: body as object,
    });
    return row;
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.enquiries.remove(id);
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "enquiry.delete",
      entity: "enquiry",
      entityId: id,
    });
    return { ok: true as const };
  }
}
