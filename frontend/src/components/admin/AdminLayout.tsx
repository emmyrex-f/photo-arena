import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  KeyRound,
  LogOut,
  Menu,
  Monitor,
  Moon,
  ShieldAlert,
  Sun,
  User,
} from "lucide-react";
import { Button } from "../../admin/components/ui/button";
import { toast } from "../../admin/components/ui/toaster";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../admin/components/ui/dropdown-menu";
import { ScrollArea } from "../../admin/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../admin/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../admin/components/ui/tooltip";
import { initials } from "../../admin/lib/format";
import { canAccessAdminPath, firstAllowedAdminPath, navSectionsForUser } from "../../admin/lib/nav";
import { hasDeskPermission } from "../../admin/lib/permissions";
import type { ThemePreference } from "../../admin/lib/theme";
import { useAdminTheme } from "../../admin/lib/theme";
import { cn } from "../../lib/cn";
import { useAuth } from "../../lib/auth";
import { CameraSpinner } from "../ui/CameraSpinner";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { EditProfileDialog } from "./EditProfileDialog";

const SIDEBAR_KEY = "pa_admin_sidebar_collapsed";

function showBadge(badge: number | string | undefined): boolean {
  if (badge == null) return false;
  if (typeof badge === "number") return badge > 0;
  return String(badge).trim().length > 0 && String(badge) !== "0";
}

function NavItems({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const sections = navSectionsForUser(user);

  // Normalize current pathname to ensure robust active state highlighting
  const currentPath = (location.pathname.replace(/\/+$/, "") || "/").toLowerCase();

  return (
    <nav className="pa-admin-nav-sections flex flex-col" aria-label="Admin">
      {sections.map((section) => (
        <div key={section.id} className="pa-admin-nav-block">
          {section.label && !collapsed ? (
            <p className="pa-admin-nav-section-label">{section.label}</p>
          ) : null}
          {section.label && collapsed ? (
            <div className="pa-admin-nav-section-rule" aria-hidden />
          ) : null}
          <div className="pa-admin-nav-list flex flex-col">
            {section.items.map((item) => {
              const itemPath = item.to.replace(/\/+$/, "").toLowerCase();
              const isActive =
                itemPath === "/admin"
                  ? currentPath === "/admin"
                  : currentPath === itemPath || currentPath.startsWith(itemPath + "/");

              const badgeVisible = showBadge(item.badge);
              const link = (
                <NavLink
                  to={item.to}
                  end={itemPath === "/admin"}
                  onClick={onNavigate}
                  className={cn(
                    "pa-admin-nav-item group relative flex cursor-pointer items-center",
                    collapsed && "pa-admin-nav-collapsed justify-center",
                    isActive && "pa-admin-nav-item--active",
                  )}
                >
                  <span className="pa-admin-nav-icon relative shrink-0">
                    <item.icon strokeWidth={1.75} aria-hidden />
                    {badgeVisible && collapsed ? (
                      <span
                        className="pa-admin-nav-badge pa-admin-nav-badge--float"
                        aria-label={`${item.badge} unread`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </span>
                  {!collapsed ? (
                    <>
                      <span className="pa-admin-nav-label min-w-0 flex-1 truncate">{item.label}</span>
                      {badgeVisible ? (
                        <span className="pa-admin-nav-badge" aria-label={`${item.badge} unread`}>
                          {item.badge}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </NavLink>
              );

              if (!collapsed) return <div key={item.to}>{link}</div>;

              return (
                <Tooltip key={item.to} delayDuration={0}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SidebarBrand({ collapsed, homeTo }: { collapsed?: boolean; homeTo: string }) {
  const { resolved } = useAdminTheme();

  if (collapsed) {
    return (
      <div className="pa-admin-header-brand pa-admin-header-brand--collapsed">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link
              to={homeTo}
              className="pa-admin-brand-mark-link--collapsed"
              aria-label="Photo Arena desk home"
            >
              <img
                src="/apple-touch-icon.png"
                alt="Photo Arena"
                className="pa-admin-brand-mark--collapsed"
                width={36}
                height={36}
                draggable={false}
              />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            Photo Arena Home
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="pa-admin-header-brand">
      <Link
        to={homeTo}
        className="flex items-center justify-center transition-opacity hover:opacity-90"
        aria-label="Photo Arena desk home"
      >
        <img
          src={resolved === "dark" ? "/admin-logo.png?v=2" : "/admin-logo-on-light.png?v=2"}
          alt="Photo Arena"
          className="pa-admin-brand-mark"
          width={150}
          height={38}
          draggable={false}
        />
      </Link>
    </div>
  );
}

function SidebarPromo() {
  return (
    <div className="pa-admin-promo">
      <img src="/admin-sidebar-promo.jpg" alt="" className="pa-admin-promo-img" />
      <div className="pa-admin-promo-veil" aria-hidden />
      <div className="pa-admin-promo-copy">
        <p>Capture</p>
        <p>Create</p>
        <p>Cherish</p>
        <span className="pa-admin-promo-rule" aria-hidden />
      </div>
    </div>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useAdminTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Theme" className="text-muted-foreground">
          <Sun className="h-4 w-4 dark:hidden" strokeWidth={1.5} />
          <Moon className="hidden h-4 w-4 dark:block" strokeWidth={1.5} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
          <DropdownMenuRadioItem value="light">
            <Sun className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Desk label under the user name — never surface “Owner”. */
function roleLabel(role: string | undefined) {
  if (role === "STAFF") return "Staff";
  return "Admin";
}

export function AdminLayout() {
  const { ready, user, logout, logoutAll } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <CameraSpinner label="Loading desk" caption="Loading desk…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  const homeTo = firstAllowedAdminPath(user);
  if (!canAccessAdminPath(user, location.pathname)) {
    return <Navigate to={homeTo} replace />;
  }

  return (
    <TooltipProvider>
      <div className="pa-admin-shell">
        <aside
          className={cn(
            "pa-admin-sidebar hidden flex-col lg:flex",
            collapsed && "pa-admin-sidebar--collapsed",
          )}
        >
          <SidebarBrand collapsed={collapsed} homeTo={homeTo} />
          <ScrollArea className="pa-admin-sidebar-scroll min-h-0 flex-1">
            <NavItems collapsed={collapsed} />
          </ScrollArea>
          {!collapsed ? <SidebarPromo /> : null}
          <div className="pa-admin-sidebar-foot">
            {collapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="pa-admin-collapse-btn pa-admin-collapse-btn--collapsed"
                    onClick={() => setCollapsed(false)}
                    aria-label="Expand sidebar"
                  >
                    <ChevronsRight className="h-4 w-4" strokeWidth={1.75} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  Expand sidebar
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="pa-admin-collapse-btn pa-admin-collapse-btn--expanded"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
              >
                <ChevronsLeft className="h-4 w-4" strokeWidth={1.75} />
                <span className="text-xs font-medium">Collapse</span>
              </Button>
            )}
          </div>
        </aside>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="pa-admin-sidebar pa-admin-sidebar--sheet w-[var(--admin-sidebar-w)] border-0 p-0"
            hideClose
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <SidebarBrand homeTo={homeTo} />
            <div className="pa-admin-sidebar-scroll flex-1 overflow-y-auto">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
            <SidebarPromo />
          </SheetContent>
        </Sheet>

        <div
          className={cn(
            "pa-admin-main-column",
            collapsed && "pa-admin-main-column--collapsed",
          )}
        >
          <header className="pa-admin-topbar z-30 flex h-admin-header shrink-0 items-center gap-3 px-admin-gutter sm:gap-4">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu strokeWidth={1.5} />
            </Button>

            <div className="ml-auto flex shrink-0 items-center gap-2.5 sm:gap-3">
              <ThemeMenu />

              {hasDeskPermission(user, "notifications") ? (
                <button
                  type="button"
                  className="pa-admin-header-icon relative inline-flex items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted/60"
                  aria-label="Notifications"
                  onClick={() => {
                    void navigate("/admin/notifications");
                  }}
                >
                  <Bell className="h-5 w-5" strokeWidth={1.5} />
                </button>
              ) : null}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Account menu for ${user.name}`}
                    className="inline-flex items-center gap-2 rounded-md py-0.5 pl-0.5 pr-0.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <span className="pa-admin-header-avatar relative flex shrink-0 items-center justify-center rounded-full border border-primary bg-[#8b7355]">
                      <span className="text-xs font-semibold tracking-wide text-white">
                        {initials(user.name)}
                      </span>
                    </span>
                    <span className="hidden min-w-0 flex-col items-start leading-none sm:flex">
                      <span className="flex items-center gap-1">
                        <span className="max-w-[140px] truncate text-xs font-semibold text-foreground">
                          {user.name}
                        </span>
                        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      </span>
                      <span className="mt-1 text-[10px] font-normal text-muted-foreground">
                        {roleLabel(user.role)}
                      </span>
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="space-y-1 font-normal">
                    <p className="font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                    <User strokeWidth={1.5} />
                    Edit profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
                    <KeyRound strokeWidth={1.5} />
                    Change password
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      if (window.confirm("Sign out of all devices? This will invalidate all your active sessions.")) {
                        await logoutAll();
                        toast.info("All active sessions revoked");
                      }
                    }}
                    className="text-amber-500 focus:text-amber-500"
                  >
                    <ShieldAlert strokeWidth={1.5} />
                    Sign out all devices
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                    <LogOut strokeWidth={1.5} />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div data-admin-scroll className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
            <main className="pa-admin-content">
              <Outlet />
            </main>
          </div>
        </div>

        <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
        <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      </div>
    </TooltipProvider>
  );
}
