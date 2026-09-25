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
  /** ISO timestamp of the current session's sign-in. */
  lastLoginAt: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<StaffUser>;
  logout: () => void;
  /** Revoke all active sessions across devices and sign out locally. */
  logoutAll: () => Promise<void>;
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
const REMEMBER_KEY = "pa_admin_remember";

function getStoredItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredSession(token: string, user: StaffUser, lastLoginAt: string, remember: boolean) {
  try {
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(LAST_LOGIN_KEY, lastLoginAt);
      localStorage.setItem(REMEMBER_KEY, "true");
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(LAST_LOGIN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      sessionStorage.setItem(LAST_LOGIN_KEY, lastLoginAt);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(LAST_LOGIN_KEY);
      localStorage.removeItem(REMEMBER_KEY);
    }
  } catch {
    // Ignore storage quota/permission exceptions
  }
}

function updateStoredUser(user: StaffUser, token?: string) {
  try {
    const isRemembered = localStorage.getItem(REMEMBER_KEY) === "true" || !!localStorage.getItem(TOKEN_KEY);
    const storage = isRemembered ? localStorage : sessionStorage;
    storage.setItem(USER_KEY, JSON.stringify(user));
    if (token) {
      storage.setItem(TOKEN_KEY, token);
    }
  } catch {
    // Ignore storage quota/permission exceptions
  }
}

function clearAllStoredSessions() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(LAST_LOGIN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LAST_LOGIN_KEY);
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    // Ignore storage quota/permission exceptions
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredItem(TOKEN_KEY));
  const [user, setUser] = useState<StaffUser | null>(() => {
    const raw = getStoredItem(USER_KEY);
    try {
      return raw ? (JSON.parse(raw) as StaffUser) : null;
    } catch {
      return null;
    }
  });
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(() => getStoredItem(LAST_LOGIN_KEY));
  const [ready, setReady] = useState(false);

  const clearSession = useCallback(() => {
    clearAllStoredSessions();
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
          updateStoredUser(me);
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
      async login(email, password, rememberMe = false) {
        const result = await api<{ token: string; user: StaffUser }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        const now = new Date().toISOString();
        setStoredSession(result.token, result.user, now, rememberMe);
        setToken(result.token);
        setUser(result.user);
        setLastLoginAt(now);
        return result.user;
      },
      logout() {
        clearSession();
      },
      async logoutAll() {
        if (token) {
          try {
            await api<{ ok: true }>("/auth/revoke-sessions", { method: "POST", token });
          } catch {
            // Even if network drops, clear local session
          }
        }
        clearSession();
      },
      applyAccount(nextUser, nextToken) {
        updateStoredUser(nextUser, nextToken);
        if (nextToken) {
          setToken(nextToken);
        }
        setUser(nextUser);
      },
      async refreshUser() {
        if (!token) return;
        const me = await api<StaffUser>("/auth/me", { token });
        setUser(me);
        updateStoredUser(me);
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
