import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
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
  const { bannerOpen, acceptAll, rejectNonEssential } = useConsent();
  const sheetRef = useRef<HTMLDivElement>(null);

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

  if (!bannerOpen) return null;

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-label="Cookie consent"
      aria-describedby="cookie-consent-copy"
      className="pa-consent-sheet fixed inset-x-0 z-[60] border-t border-border bg-bg px-gutter py-2"
    >
      <div className="mx-auto flex max-w-site flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p id="cookie-consent-copy" className="min-w-0 text-xs leading-snug text-text-secondary sm:flex-1">
          We use necessary cookies to run the site. Optional analytics and marketing cookies load only
          if you allow them.{" "}
          <Link to="/cookies" className="text-accent underline-offset-2 hover:underline">
            Cookie policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={rejectNonEssential}
            className="min-h-9 px-3 py-1.5 text-xs"
          >
            Reject optional
          </Button>
          <Button type="button" onClick={acceptAll} className="min-h-9 px-3 py-1.5 text-xs">
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
