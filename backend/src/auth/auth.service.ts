import { createHash, randomBytes } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { toAuthUser } from "./auth.types";
import type { UpdateAccountDto } from "./dto/update-account.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
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
      const token = await this.signToken(updated.id, updated.tokenVersion);
      return { user: authUser, token };
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        throw new BadRequestException("That email is already in use");
      }
      throw error;
    }
  }

  async forgotPassword(email: string, requestOrigin?: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalized, isActive: true },
    });

    if (user) {
      // Clean up any existing unredeemed tokens for this user
      await this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      const base = this.getSiteOrigin(requestOrigin);
      const resetUrl = `${base}/admin/reset-password?token=${rawToken}`;
      await this.notifications.sendPasswordResetEmail(user.email, user.name, resetUrl);
    }

    // Always return success message to prevent user enumeration
    return {
      ok: true as const,
      message: "If an active account exists for that email, a password reset link has been sent.",
    };
  }

  async verifyResetToken(rawToken: string) {
    if (!rawToken || typeof rawToken !== "string") {
      return { valid: false, message: "A reset token is required." };
    }
    const tokenHash = createHash("sha256").update(rawToken.trim()).digest("hex");
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { email: true, name: true, isActive: true } } },
    });

    if (!record || record.usedAt !== null || record.expiresAt < new Date() || !record.user?.isActive) {
      return { valid: false, message: "This reset link is invalid or has expired." };
    }

    return {
      valid: true,
      email: this.maskEmail(record.user.email),
    };
  }

  async resetPasswordWithToken(rawToken: string, newPassword: string) {
    if (!rawToken || typeof rawToken !== "string") {
      throw new BadRequestException("Reset token is required");
    }
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }

    const tokenHash = createHash("sha256").update(rawToken.trim()).digest("hex");
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true, isActive: true } } },
    });

    if (!record || record.usedAt !== null || record.expiresAt < new Date() || !record.user?.isActive) {
      throw new BadRequestException("This reset link is invalid or has expired. Please request a new one.");
    }

    await this.assertPasswordUnused(newPassword, record.userId);

    await this.prisma.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await hash(newPassword, 10),
        tokenVersion: { increment: 1 }, // Invalidates all existing active sessions
      },
    });

    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return {
      ok: true as const,
      message: "Password reset successfully. You can now sign in with your new password.",
    };
  }

  async revokeAllSessions(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Account not found");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
    return { ok: true as const };
  }

  private getSiteOrigin(requestOrigin?: string): string {
    if (requestOrigin) {
      const allowed = (this.config.get<string>("PUBLIC_SITE_ORIGINS") || "")
        .split(",")
        .map((s) => s.trim().replace(/\/$/, ""))
        .filter(Boolean);
      const cleaned = requestOrigin.trim().replace(/\/$/, "");
      if (
        allowed.includes(cleaned) ||
        cleaned.startsWith("http://localhost:") ||
        cleaned.startsWith("http://127.0.0.1:")
      ) {
        return cleaned;
      }
    }
    const origins = (this.config.get<string>("PUBLIC_SITE_ORIGINS") || "http://localhost:5173")
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean);
    return origins[0] || "http://localhost:5173";
  }

  private maskEmail(email: string): string {
    const [name, domain] = email.split("@");
    if (!name || !domain) return email;
    const visible = name.slice(0, 2);
    return `${visible}***@${domain}`;
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
