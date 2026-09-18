import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import {
  IsArray,
  IsBoolean,
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
import { parsePage, parsePageSize, paginate } from "../common/pagination";
import { slugify } from "../common/utils";
import { PrismaService } from "../prisma/prisma.service";

class CreateBlogDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  excerpt!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

class UpdateBlogDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

@Controller("admin/blog")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission("content")
export class BlogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Query("page") pageRaw?: string, @Query("q") q?: string) {
    const page = parsePage(pageRaw);
    const pageSize = parsePageSize(undefined, 20);
    const where: Prisma.BlogPostWhereInput = q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { excerpt: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};
    const [total, items] = await Promise.all([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(items, total, page, pageSize);
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const row = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Post not found");
    return row;
  }

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  async create(@Body() body: CreateBlogDto, @CurrentUser() user: AuthUser) {
    const isPublished = body.isPublished ?? false;
    const row = await this.prisma.blogPost.create({
      data: {
        title: body.title,
        slug: body.slug?.trim() || slugify(body.title),
        excerpt: body.excerpt,
        content: body.content,
        coverImageUrl: body.coverImageUrl ?? null,
        tags: body.tags ?? [],
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        authorId: user.id,
      },
    });
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "blog.create",
      entity: "blog",
      entityId: row.id,
      meta: { title: row.title },
    });
    return row;
  }

  @Patch(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async update(
    @Param("id") id: string,
    @Body() body: UpdateBlogDto,
    @CurrentUser() user: AuthUser,
  ) {
    const existing = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Post not found");

    const isPublished = body.isPublished;
    const row = await this.prisma.blogPost.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.excerpt !== undefined ? { excerpt: body.excerpt } : {}),
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.coverImageUrl !== undefined ? { coverImageUrl: body.coverImageUrl } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(isPublished !== undefined
          ? {
              isPublished,
              publishedAt:
                isPublished && !existing.publishedAt ? new Date() : existing.publishedAt,
            }
          : {}),
      },
    });
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "blog.update",
      entity: "blog",
      entityId: id,
      meta: body as object,
    });
    return row;
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.ADMIN)
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    await this.prisma.blogPost.delete({ where: { id } });
    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      action: "blog.delete",
      entity: "blog",
      entityId: id,
    });
    return { ok: true as const };
  }
}
