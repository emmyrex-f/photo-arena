import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CreditCard,
  GalleryHorizontalEnd,
  Images,
  LayoutDashboard,
  Mail,
  Quote,
  Settings2,
  Shield,
  Sparkles,
  Users,
  UsersRound,
} from "lucide-react";
import { hasDeskPermission, type DeskPermission } from "./permissions";
import type { Role } from "./types";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** If set, only these roles see the item. */
  roles?: Role[];
  /** Desk area. Settings is always visible once signed in. */
  permission?: DeskPermission;
  keywords?: string[];
};

export type NavSection = {
  id: string;
  label?: string;
  items: NavItem[];
};

export const ADMIN_NAV: NavItem[] = [
  {
    to: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "dashboard",
    keywords: ["home", "overview", "stats"],
  },
  {
    to: "/admin/bookings",
    label: "Bookings",
    icon: CalendarDays,
    permission: "bookings",
    keywords: ["schedule", "appointments", "calendar", "week", "day"],
  },
  {
    to: "/admin/payments",
    label: "Payments",
    icon: CreditCard,
    permission: "payments",
    keywords: ["revenue", "money", "transactions"],
  },
  {
    to: "/admin/customers",
    label: "Customers",
    icon: UsersRound,
    permission: "customers",
    keywords: ["crm", "clients"],
  },
  {
    to: "/admin/enquiries",
    label: "Enquiries",
    icon: Mail,
    permission: "enquiries",
    keywords: ["inbox", "leads", "contact", "messages"],
  },
  {
    to: "/admin/services",
    label: "Services",
    icon: Sparkles,
    permission: "services",
    keywords: ["catalog", "packages", "pricing", "duration"],
  },
  {
    to: "/admin/content",
    label: "Content",
    icon: BookOpen,
    permission: "content",
    keywords: ["cms", "blog", "faq", "settings"],
  },
  {
    to: "/admin/portfolio",
    label: "Portfolio",
    icon: Images,
    permission: "gallery",
    keywords: ["photos"],
  },
  {
    to: "/admin/gallery",
    label: "Media Library",
    icon: GalleryHorizontalEnd,
    permission: "gallery",
    keywords: ["photos", "media", "images", "library", "gallery", "upload"],
  },
  {
    to: "/admin/testimonials",
    label: "Testimonials",
    icon: Quote,
    permission: "testimonials",
    keywords: ["reviews"],
  },
  {
    to: "/admin/notifications",
    label: "Notifications",
    icon: Bell,
    permission: "notifications",
    keywords: ["email", "smtp", "reminders"],
  },
  { to: "/admin/settings", label: "Settings", icon: Settings2, keywords: ["theme", "password", "account", "login", "email"] },
  {
    to: "/admin/users",
    label: "Users",
    icon: Users,
    roles: ["OWNER", "ADMIN"],
    permission: "users",
    keywords: ["staff", "team", "roles"],
  },
  {
    to: "/admin/audit",
    label: "Audit",
    icon: Shield,
    permission: "audit",
    keywords: ["logs", "history"],
  },
];

const SECTION_ORDER: Array<{ id: string; label?: string; paths: string[] }> = [
  { id: "home", paths: ["/admin"] },
  {
    id: "operations",
    label: "Operations",
    paths: ["/admin/bookings", "/admin/payments", "/admin/customers", "/admin/enquiries"],
  },
  {
    id: "content",
    label: "Content",
    paths: [
      "/admin/services",
      "/admin/content",
      "/admin/portfolio",
      "/admin/gallery",
      "/admin/testimonials",
    ],
  },
  {
    id: "system",
    label: "System",
    paths: ["/admin/notifications", "/admin/settings", "/admin/users", "/admin/audit"],
  },
];

export function navForUser(user: { role?: Role; permissions?: string[] } | null | undefined): NavItem[] {
  return ADMIN_NAV.filter((item) => {
    if (item.roles && (!user?.role || !item.roles.includes(user.role))) return false;
    if (item.permission && !hasDeskPermission(user, item.permission)) return false;
    return true;
  });
}

export function navForRole(role: Role | undefined): NavItem[] {
  if (!role) return [];
  return navForUser({ role, permissions: role === "ADMIN" ? ["*"] : [] });
}

export function navSectionsForUser(user: { role?: Role; permissions?: string[] } | null | undefined): NavSection[] {
  const items = navForUser(user);
  const byPath = new Map(items.map((item) => [item.to, item]));
  return SECTION_ORDER.map((section) => ({
    id: section.id,
    label: section.label,
    items: section.paths.map((path) => byPath.get(path)).filter((item): item is NavItem => Boolean(item)),
  })).filter((section) => section.items.length > 0);
}

export function navSectionsForRole(role: Role | undefined): NavSection[] {
  return navSectionsForUser(role ? { role, permissions: role === "ADMIN" ? ["*"] : [] } : null);
}

export function permissionForPath(pathname: string): DeskPermission | null {
  const path = pathname.replace(/\/+$/, "") || "/admin";
  if (path === "/admin/settings") return null;
  if (path === "/admin") return "dashboard";
  if (path.startsWith("/admin/bookings") || path === "/admin/calendar") return "bookings";
  if (path.startsWith("/admin/payments")) return "payments";
  if (path.startsWith("/admin/customers")) return "customers";
  if (path.startsWith("/admin/enquiries") || path === "/admin/messages") return "enquiries";
  if (path.startsWith("/admin/services") || path === "/admin/packages") return "services";
  if (path.startsWith("/admin/gallery") || path === "/admin/portfolio") return "gallery";
  if (path.startsWith("/admin/testimonials")) return "testimonials";
  if (path.startsWith("/admin/content") || path.startsWith("/admin/blog")) return "content";
  if (path.startsWith("/admin/notifications")) return "notifications";
  if (path.startsWith("/admin/users")) return "users";
  if (path.startsWith("/admin/audit")) return "audit";
  return "dashboard";
}

export function canAccessAdminPath(
  user: { role?: Role; permissions?: string[] } | null | undefined,
  pathname: string,
): boolean {
  const permission = permissionForPath(pathname);
  if (!permission) return true;
  return hasDeskPermission(user, permission);
}

export function firstAllowedAdminPath(user: { role?: Role; permissions?: string[] } | null | undefined): string {
  const items = navForUser(user);
  const home = items.find((item) => item.to === "/admin");
  return home?.to ?? items[0]?.to ?? "/admin/settings";
}

export function pageTitleFromPath(pathname: string): { title: string; crumbs: string[] } {
  const path = pathname.replace(/\/+$/, "") || "/admin";
  const map: Record<string, string> = {
    "/admin": "Dashboard",
    "/admin/bookings": "Bookings",
    "/admin/calendar": "Bookings",
    "/admin/packages": "Services",
    "/admin/portfolio": "Portfolio",
    "/admin/testimonials": "Testimonials",
    "/admin/messages": "Enquiries",
    "/admin/customers": "Customers",
    "/admin/enquiries": "Enquiries",
    "/admin/services": "Services",
    "/admin/gallery": "Media Library",
    "/admin/content": "Content",
    "/admin/payments": "Payments",
    "/admin/notifications": "Notifications",
    "/admin/users": "Users",
    "/admin/audit": "Audit",
    "/admin/settings": "Settings",
  };

  if (path.startsWith("/admin/customers/") && path !== "/admin/customers") {
    return { title: "Customer", crumbs: ["Customers", "Detail"] };
  }
  if (path === "/admin/blog/new") return { title: "New post", crumbs: ["Content", "Blog", "New"] };
  if (path.startsWith("/admin/blog/")) return { title: "Edit post", crumbs: ["Content", "Blog", "Edit"] };

  const title = map[path] ?? "Desk";
  return { title, crumbs: [title] };
}
