export const FULL_ACCESS = "*";

export const DESK_PERMISSIONS = [
  { key: "dashboard", label: "Dashboard", hint: "Overview and today board" },
  { key: "bookings", label: "Bookings", hint: "Calendar, holds, walk-ins" },
  { key: "payments", label: "Payments", hint: "Transactions and export" },
  { key: "customers", label: "Customers", hint: "Client records" },
  { key: "enquiries", label: "Enquiries", hint: "Inbox and replies" },
  { key: "services", label: "Services & packages", hint: "Catalog and pricing" },
  { key: "content", label: "Content", hint: "Site copy, blog, FAQ, policies" },
  { key: "gallery", label: "Gallery & portfolio", hint: "Central media library" },
  { key: "testimonials", label: "Testimonials", hint: "Reviews on the site" },
  { key: "notifications", label: "Notifications", hint: "Email and reminders" },
  { key: "users", label: "Users", hint: "View staff accounts" },
  { key: "audit", label: "Audit log", hint: "Desk activity history" },
] as const;

export type DeskPermission = (typeof DESK_PERMISSIONS)[number]["key"];

export type DeskAccessUser = {
  role?: string;
  permissions?: string[];
};

export function hasFullDeskAccess(user: DeskAccessUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "OWNER") return true;
  if (user.role !== "ADMIN") return false;
  return (user.permissions ?? []).includes(FULL_ACCESS);
}

export function hasDeskPermission(
  user: DeskAccessUser | null | undefined,
  permission: DeskPermission,
): boolean {
  if (!user) return false;
  if (user.role === "OWNER" || user.role === "STAFF") return true;
  const perms = user.permissions ?? [];
  if (perms.includes(FULL_ACCESS)) return true;
  return perms.includes(permission);
}

export function accessSummary(user: { role: string; permissions?: string[] }): string {
  if (user.role !== "ADMIN") return "—";
  const perms = user.permissions ?? [];
  if (perms.includes(FULL_ACCESS)) return "Full access";
  if (!perms.length) return "Account only";
  return `${perms.length} area${perms.length === 1 ? "" : "s"}`;
}
