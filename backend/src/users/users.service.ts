import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
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

  async create(input: { email?: string; name: string; role: Role; password: string }) {
    const email = input.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException("Email is required");
    return this.prisma.user.create({
      data: {
        email,
        name: input.name.trim(),
        role: input.role,
        passwordHash: await hash(input.password, 10),
        isActive: true,
      },
      select: userSelect,
    });
  }

  async update(
    id: string,
    actorId: string,
    input: { name?: string; role?: Role; isActive?: boolean },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");

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

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...((input.role !== undefined && input.role !== user.role) || input.isActive === false
          ? { tokenVersion: { increment: 1 } }
          : {}),
      },
      select: userSelect,
    });
  }

  async resetPassword(id: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException("User not found");
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await hash(password, 10), tokenVersion: { increment: 1 } },
    });
    return { ok: true as const };
  }

  async softDelete(id: string, actorId: string) {
    return this.update(id, actorId, { isActive: false });
  }

  async remove(id: string, actorId: string) {
    return this.softDelete(id, actorId);
  }
}
