/**
 * Cookie consent state (contract §3).
 * `pa_cookie_consent` is a first-party cookie and a localStorage copy.
 * It lasts 180 days, then the banner asks again. Clearing site data removes it sooner.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const CONSENT_STORAGE_KEY = "pa_cookie_consent";
/** Remember the choice for 180 days unless site data is cleared. */
export const CONSENT_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const CONSENT_MAX_AGE_SEC = CONSENT_MAX_AGE_MS / 1000;

export type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

type ConsentContextValue = {
  consent: ConsentState | null;
  /** True until localStorage has been read (avoids a banner flash on hydration). */
  hydrated: boolean;
  bannerOpen: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

function parseStored(raw: string | null): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (typeof parsed.analytics !== "boolean" || typeof parsed.marketing !== "boolean") return null;
    const decidedAt = typeof parsed.decidedAt === "string" ? parsed.decidedAt : "";
    const decidedMs = Date.parse(decidedAt);
    if (!Number.isFinite(decidedMs) || Date.now() - decidedMs > CONSENT_MAX_AGE_MS) return null;
    return { necessary: true, analytics: parsed.analytics, marketing: parsed.marketing, decidedAt };
  } catch {
    return null;
  }
}

function readCookieRaw(): string | null {
  const prefix = `${CONSENT_STORAGE_KEY}=`;
  const hit = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!hit) return null;
  try {
    return decodeURIComponent(hit.slice(prefix.length));
  } catch {
    return null;
  }
}

function writeCookie(state: ConsentState) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_STORAGE_KEY}=${encodeURIComponent(JSON.stringify(state))}; Max-Age=${CONSENT_MAX_AGE_SEC}; Path=/; SameSite=Lax${secure}`;
}

function clearStored() {
  document.cookie = `${CONSENT_STORAGE_KEY}=; Max-Age=0; Path=/; SameSite=Lax`;
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

function readLocalRaw(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readStoredConsent(): ConsentState | null {
  const cookieRaw = readCookieRaw();
  const fromCookie = parseStored(cookieRaw);
  if (fromCookie) return fromCookie;
  const localRaw = readLocalRaw();
  const fromLocal = parseStored(localRaw);
  if (fromLocal) {
    writeCookie(fromLocal);
    return fromLocal;
  }
  if (cookieRaw || localRaw) clearStored();
  return null;
}

function persist(state: ConsentState) {
  writeCookie(state);
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — the cookie still holds the choice */
  }
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConsent(readStoredConsent());
    setHydrated(true);
  }, []);

  const commit = useCallback((choice: { analytics: boolean; marketing: boolean }) => {
    const next: ConsentState = { necessary: true, ...choice, decidedAt: new Date().toISOString() };
    persist(next);
    setConsent(next);
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      consent,
      hydrated,
      bannerOpen: hydrated && consent === null,
      acceptAll: () => commit({ analytics: true, marketing: true }),
      rejectNonEssential: () => commit({ analytics: false, marketing: false }),
    }),
    [consent, hydrated, commit],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const context = useContext(ConsentContext);
  if (!context) throw new Error("useConsent must be used inside <ConsentProvider>");
  return context;
}
