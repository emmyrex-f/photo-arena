/**
 * Consent-gated analytics loaders.
 * GA4 loads only with analytics consent; Meta Pixel only with marketing consent.
 * No-ops when the IDs are empty (settings `analytics.ga4Id` / `analytics.metaPixelId`).
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useConsent } from "./consent";
import { useSetting } from "./settings";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: unknown };
    _fbq?: unknown;
  }
}

const loaded = { ga4: "", pixel: "" };

function loadGa4(measurementId: string) {
  if (!measurementId || loaded.ga4 === measurementId) return;
  loaded.ga4 = measurementId;
  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { anonymize_ip: true, send_page_view: false });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

function loadMetaPixel(pixelId: string) {
  if (!pixelId || loaded.pixel === pixelId) return;
  loaded.pixel = pixelId;
  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      const fn = window.fbq as NonNullable<Window["fbq"]>;
      if (fn.callMethod) {
        (fn.callMethod as (...a: unknown[]) => void).apply(fn, args);
      } else {
        fn.queue?.push(args);
      }
    }) as NonNullable<Window["fbq"]>;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    window.fbq = fbq;
    window._fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  window.fbq("init", pixelId);
  window.fbq("track", "PageView");
}

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (loaded.ga4 && window.gtag) window.gtag("event", name, params);
  if (loaded.pixel && window.fbq) window.fbq("trackCustom", name, params);
}

/** Mount once inside the router + consent + settings providers. */
export function AnalyticsLoader() {
  const { consent } = useConsent();
  const ga4Id = useSetting("analytics.ga4Id", "");
  const pixelId = useSetting("analytics.metaPixelId", "");
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (consent?.analytics && ga4Id) loadGa4(ga4Id.trim());
  }, [consent?.analytics, ga4Id]);

  useEffect(() => {
    if (consent?.marketing && pixelId) loadMetaPixel(pixelId.trim());
  }, [consent?.marketing, pixelId]);

  useEffect(() => {
    if (!consent?.analytics || !loaded.ga4 || !window.gtag) return;
    window.gtag("event", "page_view", {
      page_path: pathname + search,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, search, consent?.analytics]);

  return null;
}
