import { Role } from "@prisma/client";
import { FULL_ACCESS } from "./permissions";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: string[];
};

/** Access the client may display. Authorization always reloads this from the database, never from the JWT. */
export function toAuthUser(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions?: string[];
}): AuthUser {
  const permissions =
    user.role === Role.OWNER
      ? [FULL_ACCESS]
      : user.role === Role.ADMIN
        ? (user.permissions ?? [])
        : [];
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions,
  };
}
