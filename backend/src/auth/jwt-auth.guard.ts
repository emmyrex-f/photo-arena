import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { toAuthUser, type AuthUser } from "./auth.types";

type JwtPayload = {
  sub: string;
  email?: string;
  name?: string;
  role?: string;
  ver?: number;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; user?: AuthUser }>();
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      throw new UnauthorizedException("Sign in required");
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          tokenVersion: true,
        },
      });
      if (!user || !user.isActive) {
        throw new UnauthorizedException("Session expired. Sign in again.");
      }
      if ((payload.ver ?? 0) !== user.tokenVersion) {
        throw new UnauthorizedException("Session expired. Sign in again.");
      }
      request.user = toAuthUser(user);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Session expired. Sign in again.");
    }
  }
}
