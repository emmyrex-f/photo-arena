import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { toAuthUser } from "./auth.types";
import type { UpdateAccountDto } from "./dto/update-account.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async deskEmail() {
    const owner = await this.prisma.user.findFirst({
      where: { role: Role.OWNER, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { email: true },
    });
    if (!owner) {
      throw new NotFoundException("Desk login is not configured");
    }
    return { email: owner.email };
  }

  async login(email: string, password: string) {
    const submittedEmail = email.trim().toLowerCase();
    const invalid = () => {
      throw new UnauthorizedException("Email or password is incorrect");
    };

    const ownerRow = await this.prisma.user.findFirst({
      where: { role: Role.OWNER, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    // One studio email only. Wrong email and wrong password share the same error text.
    if (!ownerRow || submittedEmail !== ownerRow.email.toLowerCase()) {
      invalid();
    }
    const owner = ownerRow!;

    const activeUsers = await this.prisma.user.findMany({
      where: { isActive: true },
    });

    // Password selects the person. Owner wins if the password matches the owner.
    if (await compare(password, owner.passwordHash)) {
      return this.issueSession(owner);
    }

    const matches: typeof activeUsers = [];
    for (const candidate of activeUsers) {
      if (candidate.id === owner.id) continue;
      if (await compare(password, candidate.passwordHash)) {
        matches.push(candidate);
      }
    }
    if (matches.length !== 1) {
      invalid();
    }

    return this.issueSession(matches[0]!);
  }

  private async issueSession(user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    permissions: string[];
    tokenVersion: number;
  }) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const authUser = toAuthUser(user);
    const token = await this.jwt.signAsync({
      sub: authUser.id,
      ver: user.tokenVersion,
    });

    return { token, user: authUser };
  }

  async me(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Account not found");
    }
    return toAuthUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Account not found");
    }
    if (!(await compare(currentPassword, user.passwordHash))) {
      throw new ForbiddenException("Current password is incorrect");
    }
    await this.assertPasswordUnused(newPassword, userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hash(newPassword, 10),
        tokenVersion: { increment: 1 },
      },
    });
    return { ok: true as const };
  }

  async updateAccount(userId: string, body: UpdateAccountDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Account not found");
    }
    if (user.role !== Role.OWNER) {
      throw new ForbiddenException("Only the owner can change desk login details");
    }
    if (!(await compare(body.currentPassword, user.passwordHash))) {
      throw new ForbiddenException("Current password is incorrect");
    }

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const newPassword = body.newPassword?.trim() || undefined;
    const nextName = name && name !== user.name ? name : undefined;
    const nextEmail = email && email !== user.email ? email : undefined;

    if (!nextName && !nextEmail && !newPassword) {
      throw new BadRequestException("Nothing to update");
    }

    if (nextEmail) {
      const taken = await this.prisma.user.findFirst({
        where: { email: nextEmail, id: { not: userId } },
        select: { id: true },
      });
      if (taken) {
        throw new BadRequestException("That email is already in use");
      }
    }
    if (newPassword) {
      await this.assertPasswordUnused(newPassword, userId);
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...(nextName ? { name: nextName } : {}),
          ...(nextEmail ? { email: nextEmail } : {}),
          ...(newPassword
            ? { passwordHash: await hash(newPassword, 10), tokenVersion: { increment: 1 } }
            : {}),
        },
      });
      const authUser = toAuthUser(updated);
      if (!newPassword) {
        return { user: authUser };
      }
      const token = await this.signToken(updated.id, updated.tokenVersion);
      return { user: authUser, token };
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new BadRequestException("That email is already in use");
      }
      throw error;
    }
  }

  private signToken(userId: string, tokenVersion: number) {
    return this.jwt.signAsync({
      sub: userId,
      ver: tokenVersion,
    });
  }

  private async assertPasswordUnused(password: string, exceptUserId: string) {
    const others = await this.prisma.user.findMany({
      where: { isActive: true, id: { not: exceptUserId } },
      select: { passwordHash: true },
    });
    for (const other of others) {
      if (await compare(password, other.passwordHash)) {
        throw new BadRequestException("Password must be unique across desk users");
      }
    }
  }
}
