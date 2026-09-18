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
import { parsePage, parsePageSize, paginate } from "../common/pagination";
import { PrismaService } from "../prisma/prisma.service";

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
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Query("status") status?: string, @Query("page") pageRaw?: string) {
    const page = parsePage(pageRaw);
    const pageSize = parsePageSize(undefined, 20);
    const where = status ? { status: status as EnquiryStatus } : {};
    const [total, items] = await Promise.all([
      this.prisma.enquiry.count({ where }),
      this.prisma.enquiry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async update(
    @Param("id") id: string,
    @Body() body: UpdateEnquiryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const row = await this.prisma.enquiry.update({
      where: { id },
      data: {
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.internalNote !== undefined ? { internalNote: body.internalNote || null } : {}),
      },
    });
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
    await this.prisma.enquiry.delete({ where: { id } });
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
