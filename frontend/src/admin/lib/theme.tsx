import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "pa_admin_theme";

type ThemeContextValue = {
  theme: ThemePreference;
  resolved: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  /** Element that Radix portals should render into (inside `.admin-root`, so tokens apply). */
  portalContainer: HTMLElement | null;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

function systemTheme(): ResolvedTheme {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Renders the `.admin-root` element and toggles `.dark` on it based on the persisted preference.
 * Also hosts the portal container so Dialog/Popover/Select content inherits the admin tokens.
 */
export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readPreference);
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystem(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const resolved: ResolvedTheme = theme === "system" ? system : theme;

  // Keep the document background in sync so overscroll/rubber-banding doesn't flash the public palette.
  useEffect(() => {
    const previous = document.body.style.backgroundColor;
    const previousScheme = document.documentElement.style.colorScheme;
    document.body.style.backgroundColor = resolved === "dark" ? "hsl(210 15% 5%)" : "hsl(40 20% 98%)";
    document.documentElement.style.colorScheme = resolved;
    return () => {
      document.body.style.backgroundColor = previous;
      document.documentElement.style.colorScheme = previousScheme;
    };
  }, [resolved]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved, setTheme, portalContainer }),
    [theme, resolved, setTheme, portalContainer],
  );

  return (
    <ThemeContext.Provider value={value}>
      <div className={cn("admin-root h-dvh overflow-hidden", resolved === "dark" && "dark")} data-theme={resolved}>
        {children}
        <div ref={setPortalContainer} className="admin-portal" />
      </div>
    </ThemeContext.Provider>
  );
}

export function useAdminTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAdminTheme must be used inside AdminThemeProvider");
  return ctx;
}

/** Container for Radix portals. `undefined` (before mount) falls back to document.body. */
export function usePortalContainer(): HTMLElement | undefined {
  const ctx = useContext(ThemeContext);
  return ctx?.portalContainer ?? undefined;
}
