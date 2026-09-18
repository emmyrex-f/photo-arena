import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useConsent } from "../../lib/consent";
import { Button } from "../ui/Button";

function syncConsentHeight(open: boolean, el: HTMLElement | null) {
  const root = document.documentElement;
  if (!open || !el) {
    root.classList.remove("pa-consent-on");
    root.style.setProperty("--pa-consent", "0px");
    return;
  }
  root.classList.add("pa-consent-on");
  root.style.setProperty("--pa-consent", `${Math.ceil(el.getBoundingClientRect().height)}px`);
}

export function CookieBanner() {
  const {
    bannerOpen,
    preferencesOpen,
    consent,
    acceptAll,
    rejectNonEssential,
    save,
    openPreferences,
    closePreferences,
  } = useConsent();
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const prefsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preferencesOpen) {
      setAnalytics(consent?.analytics ?? false);
      setMarketing(consent?.marketing ?? false);
    }
  }, [preferencesOpen, consent]);

  useLayoutEffect(() => {
    const el = sheetRef.current;
    syncConsentHeight(bannerOpen, el);
    if (!bannerOpen || !el) {
      return () => syncConsentHeight(false, null);
    }
    const observer = new ResizeObserver(() => syncConsentHeight(true, el));
    observer.observe(el);
    return () => {
      observer.disconnect();
      syncConsentHeight(false, null);
    };
  }, [bannerOpen]);

  useEffect(() => {
    if (!preferencesOpen) return;
    prefsRef.current?.focus();
  }, [preferencesOpen]);

  if (!bannerOpen && !preferencesOpen) return null;

  return (
    <>
      {bannerOpen ? (
        <div
          ref={sheetRef}
          role="dialog"
          aria-label="Cookie consent"
          aria-describedby="cookie-consent-copy"
          className="pa-consent-sheet fixed inset-x-0 z-[60] border-t border-border bg-bg px-gutter pt-eyebrow lg:border-0 lg:bg-transparent lg:pt-6"
        >
          <div className="lg:mx-auto lg:flex lg:max-w-3xl lg:flex-row lg:items-end lg:gap-6 lg:border lg:border-border lg:bg-bg lg:p-card lg:shadow-[var(--shadow-soft)]">
            <div className="min-w-0 flex-1">
              <p className="hidden font-display text-xl text-text lg:block">Cookies</p>
              <p
                id="cookie-consent-copy"
                className="text-xs leading-tight text-text-secondary sm:text-sm sm:leading-snug lg:mt-2 lg:text-sm lg:leading-relaxed"
              >
                <span className="lg:hidden">
                  Necessary cookies keep the site working. Analytics and marketing need your
                  permission.
                </span>
                <span className="hidden lg:inline">
                  We use necessary cookies to run the site. Analytics and marketing cookies load only
                  if you allow them — in line with NDPR expectations for Port Harcourt visitors.
                </span>
              </p>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1 sm:mt-3 sm:gap-2 lg:mt-0 lg:flex lg:flex-wrap">
              <Button
                type="button"
                onClick={acceptAll}
                className="col-span-2 min-h-11 px-3 text-sm whitespace-nowrap lg:order-3 lg:col-auto lg:min-h-10 lg:px-4"
              >
                Accept all
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={rejectNonEssential}
                className="min-h-11 px-2 text-sm whitespace-nowrap lg:order-2 lg:min-h-10 lg:px-4"
              >
                Reject optional
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={openPreferences}
                className="min-h-11 px-2 text-sm whitespace-nowrap lg:order-1 lg:min-h-10 lg:px-4"
              >
                Manage preferences
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {preferencesOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div
            ref={prefsRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-prefs-title"
            tabIndex={-1}
            className="max-h-[min(32rem,calc(100dvh-2rem))] w-full max-w-lg overflow-y-auto border border-border bg-bg p-card shadow-[var(--shadow-soft)]"
          >
            <h2 id="cookie-prefs-title" className="font-display text-2xl text-text">
              Cookie preferences
            </h2>
            <p className="mt-label text-sm text-text-secondary">
              Necessary cookies are always on. Choose optional categories below.
            </p>
            <ul className="mt-6 space-y-stack-sm text-sm">
              <li className="flex items-start justify-between gap-4 border-b border-elevated pb-4">
                <div>
                  <p className="font-medium text-text">Necessary</p>
                  <p className="text-text-secondary">Security, consent storage, booking flow.</p>
                </div>
                <span className="text-text-muted">Always on</span>
              </li>
              <li>
                <label className="flex min-h-11 items-start justify-between gap-4 border-b border-elevated pb-4">
                  <span>
                    <span className="block font-medium text-text">Analytics</span>
                    <span className="block text-text-secondary">
                      Optional analytics (only if a measurement ID is configured in admin).
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={analytics}
                    onChange={(e) => setAnalytics(e.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
                  />
                </label>
              </li>
              <li>
                <label className="flex min-h-11 items-start justify-between gap-4">
                  <span>
                    <span className="block font-medium text-text">Marketing</span>
                    <span className="block text-text-secondary">
                      Optional advertising tags, only if a pixel ID is configured.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={marketing}
                    onChange={(e) => setMarketing(e.target.checked)}
                    className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
                  />
                </label>
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap justify-end gap-grid-tight sm:mt-8">
              <Button type="button" variant="ghost" onClick={closePreferences}>
                Cancel
              </Button>
              <Button type="button" onClick={() => save({ analytics, marketing })}>
                Save preferences
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
