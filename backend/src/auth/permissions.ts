import { Role } from "@prisma/client";

export const FULL_ACCESS = "*";

export const DESK_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "bookings", label: "Bookings" },
  { key: "payments", label: "Payments" },
  { key: "customers", label: "Customers" },
  { key: "enquiries", label: "Enquiries" },
  { key: "services", label: "Services & packages" },
  { key: "content", label: "Content (site, blog, FAQ)" },
  { key: "gallery", label: "Gallery & portfolio" },
  { key: "testimonials", label: "Testimonials" },
  { key: "notifications", label: "Notifications" },
  { key: "users", label: "Users (view)" },
  { key: "audit", label: "Audit log" },
] as const;

export type DeskPermission = (typeof DESK_PERMISSIONS)[number]["key"];

export const DESK_PERMISSION_KEYS: DeskPermission[] = DESK_PERMISSIONS.map((item) => item.key);

export function isDeskPermission(value: string): value is DeskPermission {
  return (DESK_PERMISSION_KEYS as string[]).includes(value);
}

export function sanitizePermissionList(raw: unknown): DeskPermission[] {
  if (!Array.isArray(raw)) return [];
  const out: DeskPermission[] = [];
  for (const item of raw) {
    if (typeof item === "string" && isDeskPermission(item) && !out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}

export function resolveAdminPermissions(input: {
  role: Role;
  fullAccess?: boolean;
  permissions?: string[];
  previous?: string[];
  isCreate: boolean;
}): string[] {
  if (input.role !== Role.ADMIN) return [];
  if (input.fullAccess === true) return [FULL_ACCESS];
  if (input.fullAccess === false) return sanitizePermissionList(input.permissions);
  if (input.permissions?.includes(FULL_ACCESS)) return [FULL_ACCESS];
  if (input.permissions && input.permissions.length > 0) {
    return sanitizePermissionList(input.permissions);
  }
  if (input.isCreate) return [FULL_ACCESS];
  if (input.previous?.includes(FULL_ACCESS)) return [FULL_ACCESS];
  if (input.previous) return sanitizePermissionList(input.previous);
  return [FULL_ACCESS];
}

export function hasDeskPermission(
  user: { role: Role; permissions?: string[] } | null | undefined,
  permission: DeskPermission,
): boolean {
  if (!user) return false;
  if (user.role === Role.OWNER) return true;
  if (user.role === Role.STAFF) return true;
  const perms = user.permissions ?? [];
  if (perms.includes(FULL_ACCESS)) return true;
  return perms.includes(permission);
}
