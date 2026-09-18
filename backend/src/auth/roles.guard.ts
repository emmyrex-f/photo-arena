import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@prisma/client";
import type { AuthUser } from "./auth.types";
import { PERMISSION_KEY } from "./permissions.decorator";
import { hasDeskPermission, type DeskPermission } from "./permissions";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const permission = this.reflector.getAllAndOverride<DeskPermission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;

    if (roles?.length) {
      if (!user || !roles.includes(user.role)) {
        throw new ForbiddenException("You do not have permission for this action");
      }
    }

    if (permission) {
      if (!user || !hasDeskPermission(user, permission)) {
        throw new ForbiddenException("You do not have access to this area");
      }
    }

    return true;
  }
}
