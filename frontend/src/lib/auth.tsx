import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { hasDeskPermission, type DeskPermission } from "../admin/lib/permissions";
import { api } from "./api";

export type Role = "OWNER" | "ADMIN" | "STAFF";

export type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions?: string[];
  isActive?: boolean;
  lastLoginAt?: string | null;
};

type AuthContextValue = {
  token: string | null;
  user: StaffUser | null;
  ready: boolean;
  /** ISO timestamp of the current session's sign-in (persisted for this tab). */
  lastLoginAt: string | null;
  login: (email: string, password: string) => Promise<StaffUser>;
  logout: () => void;
  /** Apply a fresh token after the owner updates login details. */
  applyAccount: (user: StaffUser, token?: string) => void;
  /** Re-fetch `/auth/me` (after name/role changes). */
  refreshUser: () => Promise<void>;
  /** True when the signed-in user has one of the given roles. */
  hasRole: (...roles: Role[]) => boolean;
  hasPermission: (permission: DeskPermission) => boolean;
};

const TOKEN_KEY = "pa_admin_token";
const USER_KEY = "pa_admin_user";
const LAST_LOGIN_KEY = "pa_admin_last_login";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<StaffUser | null>(() => {
    const raw = sessionStorage.getItem(USER_KEY);
    try {
      return raw ? (JSON.parse(raw) as StaffUser) : null;
    } catch {
      return null;
    }
  });
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(() => sessionStorage.getItem(LAST_LOGIN_KEY));
  const [ready, setReady] = useState(false);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(LAST_LOGIN_KEY);
    setToken(null);
    setUser(null);
    setLastLoginAt(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (!token) {
        setReady(true);
        return;
      }
      try {
        const me = await api<StaffUser>("/auth/me", { token });
        if (!cancelled) {
          setUser(me);
          sessionStorage.setItem(USER_KEY, JSON.stringify(me));
        }
      } catch (err) {
        // Only drop the session when the token is actually rejected; keep it on network failure.
        const status = (err as { status?: number })?.status;
        if (!cancelled && (status === 401 || status === 403)) {
          clearSession();
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [token, clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      ready,
      lastLoginAt,
      async login(email, password) {
        const result = await api<{ token: string; user: StaffUser }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        const now = new Date().toISOString();
        sessionStorage.setItem(TOKEN_KEY, result.token);
        sessionStorage.setItem(USER_KEY, JSON.stringify(result.user));
        sessionStorage.setItem(LAST_LOGIN_KEY, now);
        setToken(result.token);
        setUser(result.user);
        setLastLoginAt(now);
        return result.user;
      },
      logout() {
        clearSession();
      },
      applyAccount(nextUser, nextToken) {
        if (nextToken) {
          sessionStorage.setItem(TOKEN_KEY, nextToken);
          setToken(nextToken);
        }
        sessionStorage.setItem(USER_KEY, JSON.stringify(nextUser));
        setUser(nextUser);
      },
      async refreshUser() {
        if (!token) return;
        const me = await api<StaffUser>("/auth/me", { token });
        setUser(me);
        sessionStorage.setItem(USER_KEY, JSON.stringify(me));
      },
      hasRole(...roles) {
        return !!user && roles.includes(user.role);
      },
      hasPermission(permission) {
        return hasDeskPermission(user, permission);
      },
    }),
    [token, user, ready, lastLoginAt, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function canManageBookings(role?: Role) {
  return role === "OWNER" || role === "ADMIN";
}

/** Standalone role check (no hook) — useful in non-component code. */
export function hasRole(user: StaffUser | null | undefined, ...roles: Role[]) {
  return !!user && roles.includes(user.role);
}

export function isOwner(role?: Role) {
  return role === "OWNER";
}
