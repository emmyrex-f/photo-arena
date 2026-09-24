/**
 * Site settings from GET /public/settings, fetched once, with src/lib/site.ts defaults.
 * The site must render fully when the API is offline — every consumer passes a fallback.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchSettings, type SettingsMap } from "./publicApi";
import { site } from "./site";

type SettingsContextValue = {
  settings: SettingsMap;
  status: "loading" | "ready" | "offline";
  get: (key: string, fallback?: string) => string;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Defaults for keys that have a home in site.ts. Missing API keys resolve here. */
const defaults: SettingsMap = {
  "site.name": site.name,
  "site.tagline": site.tagline,
  "site.phone": site.phone,
  "site.email": site.email,
  "site.whatsapp": site.whatsapp,
  "site.address": site.address.full,
  "site.hours.weekday": site.hoursWeekday,
  "site.hours.sunday": site.hoursSunday,
  "site.mapEmbed": site.mapEmbed,
  "social.instagram": site.instagram,
  "social.facebook": site.facebook,
  "social.tiktok": site.tiktok,
  "hero.headline": site.hero.headline,
  "hero.subheadline": site.hero.subheadline,
  "hero.videoUrl": site.hero.videoUrl,
  "tour.heading": site.tour.heading,
  "tour.body": site.tour.body,
  "tour.videoUrl": site.tour.videoUrl,
  "cta.heading": site.cta.heading,
  "cta.body": site.cta.body,
  "cta.buttonLabel": site.cta.buttonLabel,
  "cta.buttonHref": site.cta.buttonHref,
  "about.headline": site.about.headline,
  "about.body": site.about.body,
  "about.imageUrl": site.about.imageUrl,
  "about.ctaLabel": site.about.ctaLabel,
  "about.ctaHref": site.about.ctaHref,
  "seo.defaultTitle": site.seo.defaultTitle,
  "seo.defaultDescription": site.seo.defaultDescription,
  "seo.ogImage": site.seo.ogImage,
  "analytics.ga4Id": "",
  "analytics.metaPixelId": "",
  "instagram.items": "",
};

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [status, setStatus] = useState<SettingsContextValue["status"]>("loading");

  useEffect(() => {
    let cancelled = false;

    function load() {
      fetchSettings().then(({ data, source }) => {
        if (cancelled) return;
        setSettings(data);
        setStatus(source === "api" ? "ready" : "offline");
      });
    }

    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const get = useCallback(
    (key: string, fallback?: string) => {
      const value = settings[key];
      if (typeof value === "string" && value.trim() !== "") return value.trim();
      if (fallback !== undefined) return fallback.trim();
      return (defaults[key] ?? "").trim();
    },
    [settings],
  );

  const value = useMemo(() => ({ settings, status, get }), [settings, status, get]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    // Allow components to render outside the provider (tests, isolated previews).
    return { settings: {}, status: "offline", get: (key, fallback) => fallback ?? defaults[key] ?? "" };
  }
  return context;
}

/** Read one setting with a fallback. Empty API values fall through to the fallback. */
export function useSetting(key: string, fallback?: string): string {
  const { get } = useSettings();
  return get(key, fallback);
}

/** Parses a JSON setting, returning the fallback on any failure. */
export function useJsonSetting<T>(key: string, fallback: T): T {
  const raw = useSetting(key, "");
  return useMemo(() => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }, [raw, fallback]);
}

/** Display-only: strip trailing spaces/periods so templates can add punctuation safely. */
export function displayHours(value: string): string {
  return value.trim().replace(/[.\s]+$/g, "");
}

/** Public label from a CMS Instagram URL. Does not invent a handle if the URL cannot be parsed. */
export function instagramHandleFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname.split("/").filter(Boolean)[0];
    if (!path) return fallback;
    const handle = decodeURIComponent(path);
    return handle.startsWith("@") ? handle : `@${handle}`;
  } catch {
    return fallback;
  }
}
export function useSiteInfo() {
  const { get } = useSettings();
  const phone = get("site.phone");
  const email = get("site.email");
  const digits = phone.replace(/\D/g, "");
  const phoneHref = digits.startsWith("0") ? `tel:+234${digits.slice(1)}` : digits ? `tel:+${digits}` : site.phoneHref;
  return {
    name: get("site.name"),
    tagline: get("site.tagline"),
    phone,
    phoneHref,
    email,
    emailHref: `mailto:${email}`,
    whatsapp: get("site.whatsapp"),
    address: get("site.address").trim(),
    hoursWeekday: displayHours(get("site.hours.weekday")),
    hoursSunday: displayHours(get("site.hours.sunday")),
    mapEmbed: get("site.mapEmbed"),
    instagram: get("social.instagram"),
    facebook: get("social.facebook"),
    tiktok: get("social.tiktok"),
  };
}
