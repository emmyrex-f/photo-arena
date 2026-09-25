import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { resolveDeskPermissions } from "../auth/permissions";
import { PrismaService } from "../prisma/prisma.service";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  permissions: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: "asc" },
    });
  }

  async create(input: {
    email?: string;
    name: string;
    role: Role;
    password: string;
    fullAccess?: boolean;
    permissions?: string[];
  }) {
    const email = input.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException("Email is required");
    if (input.password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }
    await this.assertPasswordUnique(input.password);

    const permissions = resolveDeskPermissions({
      role: input.role,
      fullAccess: input.fullAccess,
      permissions: input.permissions,
    });

    try {
      return await this.prisma.user.create({
        data: {
          email,
          name: input.name.trim(),
          role: input.role,
          passwordHash: await hash(input.password, 10),
          isActive: true,
          permissions,
        },
        select: userSelect,
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new BadRequestException("A user with this email already exists");
      }
      throw error;
    }
  }

  async update(
    id: string,
    actorId: string,
    input: {
      email?: string;
      name?: string;
      role?: Role;
      isActive?: boolean;
      fullAccess?: boolean;
      permissions?: string[];
    },
    actorRole?: Role,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

    if (actorRole && actorRole !== Role.OWNER) {
      if (user.role === Role.OWNER) {
        throw new ForbiddenException("Only the owner can modify or delete owner accounts");
      }
      if (input.role === Role.OWNER) {
        throw new ForbiddenException("Only the owner can assign the owner role");
      }
      if ((input.fullAccess !== undefined || input.permissions !== undefined) && id !== actorId) {
        throw new ForbiddenException("Only the owner can modify user permissions");
      }
    }

    const email = input.email !== undefined ? input.email.trim().toLowerCase() : undefined;
    if (email !== undefined) {
      if (!email) {
        throw new BadRequestException("Email is required");
      }
      if (email !== user.email) {
        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing && existing.id !== id) {
          throw new BadRequestException("A user with this email already exists");
        }
      }
    }

    if (input.role !== undefined || input.isActive === false) {
      if (user.role === Role.OWNER && (input.role !== Role.OWNER || input.isActive === false)) {
        const owners = await this.prisma.user.count({
          where: { role: Role.OWNER, isActive: true },
        });
        if (owners <= 1) {
          throw new BadRequestException("Cannot demote or deactivate the last OWNER");
        }
      }
      if (id === actorId && (input.isActive === false || (input.role && input.role !== user.role))) {
        throw new ForbiddenException("Cannot demote or deactivate yourself");
      }
    }

    const nextRole = input.role ?? user.role;
    const permissionsTouched = input.fullAccess !== undefined || input.permissions !== undefined;
    const nextPermissions = permissionsTouched
      ? resolveDeskPermissions({
          role: nextRole,
          fullAccess: input.fullAccess,
          permissions: input.permissions,
          previous: user.permissions,
        })
      : input.role !== undefined && input.role !== user.role
        ? resolveDeskPermissions({
            role: nextRole,
            previous: user.permissions,
          })
        : undefined;

    const bumpToken =
      (input.role !== undefined && input.role !== user.role) ||
      input.isActive === false ||
      (nextPermissions !== undefined &&
        JSON.stringify([...nextPermissions].sort()) !== JSON.stringify([...user.permissions].sort()));

    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          ...(email !== undefined ? { email } : {}),
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(nextPermissions !== undefined ? { permissions: nextPermissions } : {}),
          ...(bumpToken ? { tokenVersion: { increment: 1 } } : {}),
        },
        select: userSelect,
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new BadRequestException("A user with this email already exists");
      }
      throw error;
    }
  }

  async resetPassword(id: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    if (password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }
    await this.assertPasswordUnique(password, id);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await hash(password, 10), tokenVersion: { increment: 1 } },
    });
    return { ok: true as const };
  }

  async revokeSessions(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    await this.prisma.user.update({
      where: { id },
      data: { tokenVersion: { increment: 1 } },
    });
    return { ok: true as const };
  }

  async softDelete(id: string, actorId: string, actorRole?: Role) {
    return this.update(id, actorId, { isActive: false }, actorRole);
  }

  async remove(id: string, actorId: string, actorRole?: Role) {
    return this.softDelete(id, actorId, actorRole);
  }

  private async assertPasswordUnique(password: string, exceptUserId?: string) {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, passwordHash: true },
    });
    for (const row of users) {
      if (exceptUserId && row.id === exceptUserId) continue;
      if (await compare(password, row.passwordHash)) {
        throw new BadRequestException("Password must be unique across active desk users");
      }
    }
  }
}
