import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ChevronsLeft,
  ChevronsRight,
  KeyRound,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";
import { Avatar, AvatarFallback } from "../../admin/components/ui/avatar";
import { Button } from "../../admin/components/ui/button";
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
import { RoleBadge } from "../../admin/components/ui/status-badge";
import { ScrollArea } from "../../admin/components/ui/scroll-area";
import { Separator } from "../../admin/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../admin/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../admin/components/ui/tooltip";
import { initials } from "../../admin/lib/format";
import { canAccessAdminPath, firstAllowedAdminPath, navSectionsForUser, pageTitleFromPath } from "../../admin/lib/nav";
import type { ThemePreference } from "../../admin/lib/theme";
import { useAdminTheme } from "../../admin/lib/theme";
import { cn } from "../../lib/cn";
import { useAuth } from "../../lib/auth";
import { AdminLogo } from "./AdminLogo";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

const SIDEBAR_KEY = "pa_admin_sidebar_collapsed";

function NavItems({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { user } = useAuth();
  const sections = navSectionsForUser(user);

  return (
    <nav className="flex flex-col gap-admin-stack-sm px-admin-sidebar" aria-label="Admin">
      {sections.map((section) => (
        <div key={section.id}>
          {section.label && !collapsed ? (
            <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--sidebar-foreground))]/40">
              {section.label}
            </p>
          ) : null}
          {section.label && collapsed ? (
            <div className="mx-auto mb-1 h-px w-6 bg-[hsl(var(--sidebar-border))]" aria-hidden />
          ) : null}
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const end = item.to === "/admin";
              return (
                <Tooltip key={item.to} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <NavLink
                      to={item.to}
                      end={end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                          collapsed && "justify-center px-0",
                          isActive
                            ? "bg-sidebar-active/15 text-[hsl(var(--sidebar-active))]"
                            : "text-[hsl(var(--sidebar-foreground))]/75 hover:bg-black/5 hover:text-[hsl(var(--sidebar-foreground))] dark:hover:bg-white/5",
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </NavLink>
                  </TooltipTrigger>
                  {collapsed ? <TooltipContent side="right">{item.label}</TooltipContent> : null}
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
  return (
    <Link
      to={homeTo}
      className={cn(
        "flex items-center gap-admin-gap px-admin-stack-sm py-admin-stack-sm text-[hsl(var(--sidebar-foreground))]",
        collapsed && "justify-center px-2",
      )}
    >
      <AdminLogo className={cn("shrink-0", collapsed ? "h-8 max-w-[52px] object-contain" : "h-10")} />
      {!collapsed ? (
        <p className="min-w-0 truncate text-[11px] uppercase tracking-[0.16em] text-[hsl(var(--sidebar-foreground))]/55">
          Studio desk
        </p>
      ) : null}
    </Link>
  );
}

function ThemeMenu() {
  const { theme, setTheme } = useAdminTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Theme">
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
          <DropdownMenuRadioItem value="light">
            <Sun className="mr-2 h-3.5 w-3.5" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="mr-2 h-3.5 w-3.5" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="mr-2 h-3.5 w-3.5" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminLayout() {
  const { ready, user, logout } = useAuth();
  const location = useLocation();
  const { title, crumbs } = pageTitleFromPath(location.pathname);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

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

  // #region agent log
  useEffect(() => {
    const report = (runId: string, extra: Record<string, unknown> = {}) => {
      const root = document.querySelector(".admin-root");
      const header = document.querySelector("header");
      const aside = document.querySelector("aside");
      const scroller = document.querySelector("[data-admin-scroll]");
      const se = document.scrollingElement;
      fetch("http://127.0.0.1:7692/ingest/cb172e59-2268-4533-a30f-2583756cd36a", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "399eda" },
        body: JSON.stringify({
          sessionId: "399eda",
          runId,
          hypothesisId: "A",
          location: "AdminLayout.tsx:scroll",
          message: "admin scroll + sticky chrome",
          data: {
            path: location.pathname,
            innerH: window.innerHeight,
            winY: window.scrollY,
            htmlSt: se?.scrollTop ?? null,
            rootOy: root ? getComputedStyle(root).overflowY : null,
            rootOx: root ? getComputedStyle(root).overflowX : null,
            rootCan: root ? root.scrollHeight > root.clientHeight + 2 : null,
            headerTop: header ? Math.round(header.getBoundingClientRect().top) : null,
            asideTop: aside ? Math.round(aside.getBoundingClientRect().top) : null,
            scrollerSt: scroller?.scrollTop ?? null,
            scrollerCan: scroller ? scroller.scrollHeight > scroller.clientHeight + 2 : null,
            htmlCan: document.documentElement.scrollHeight > document.documentElement.clientHeight + 2,
            htmlSh: document.documentElement.scrollHeight,
            htmlCh: document.documentElement.clientHeight,
            htmlOy: getComputedStyle(document.documentElement).overflowY,
            scrollerVBar: scroller ? scroller.offsetWidth - scroller.clientWidth : null,
            ...extra,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    };
    report("admin-scroll-mount");
    const scroller = document.querySelector("[data-admin-scroll]");
    const onScroll = () => report("admin-scroll-move", { source: "scroller" });
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [location.pathname]);
  // #endregion

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading desk…
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
      <div className="flex h-full min-h-0 overflow-hidden bg-background text-foreground">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "hidden h-full shrink-0 flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] transition-[width] duration-200 lg:flex",
            collapsed ? "w-[68px]" : "w-60",
          )}
        >
          <SidebarBrand collapsed={collapsed} homeTo={homeTo} />
          <Separator className="bg-[hsl(var(--sidebar-border))]" />
          <ScrollArea className="min-h-0 flex-1 py-admin-nav">
            <NavItems collapsed={collapsed} />
          </ScrollArea>
          <div className="border-t border-[hsl(var(--sidebar-border))] p-2">
            <Button
              variant="ghost"
              size={collapsed ? "icon-sm" : "sm"}
              className={cn(
                "w-full text-[hsl(var(--sidebar-foreground))]/70 hover:bg-black/5 hover:text-[hsl(var(--sidebar-foreground))] dark:hover:bg-white/5",
                !collapsed && "justify-start",
              )}
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
              {!collapsed ? "Collapse" : null}
            </Button>
          </div>
        </aside>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="w-[280px] border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] p-0 text-[hsl(var(--sidebar-foreground))]"
            hideClose
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <SidebarBrand homeTo={homeTo} />
            <Separator className="bg-[hsl(var(--sidebar-border))]" />
            <div className="py-admin-nav">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="z-30 flex h-admin-header shrink-0 items-center gap-admin-gap border-b border-border bg-card/90 px-admin-gutter backdrop-blur sm:gap-admin-stack-sm">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu />
            </Button>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold sm:text-base">{title}</p>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
                {crumbs.join(" / ")}
              </p>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
              <ThemeMenu />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 pl-1.5 pr-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/15 text-xs text-primary">
                        {initials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-[120px] truncate text-sm sm:inline">{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="space-y-1 font-normal">
                    <p className="font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    <RoleBadge role={user.role} className="mt-1" />
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
                    <KeyRound />
                    Change password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                    <LogOut />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div data-admin-scroll className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain">
            <main className="mx-auto w-full max-w-[1400px] min-w-0 px-admin-gutter py-admin-page">
              <Outlet />
            </main>
          </div>
        </div>

        <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      </div>
    </TooltipProvider>
  );
}
