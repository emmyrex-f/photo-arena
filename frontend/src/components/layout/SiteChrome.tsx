import { Link, useLocation } from "react-router-dom";
import { WhatsAppIcon } from "../icons/WhatsAppIcon";
import { useSiteInfo } from "../../lib/settings";

export function WhatsAppFab() {
  const { whatsapp } = useSiteInfo();
  if (!whatsapp) return null;
  const href = whatsapp.includes("text=")
    ? whatsapp
    : `${whatsapp}${whatsapp.includes("?") ? "&" : "?"}text=${encodeURIComponent(
        "Hello Photo Arena, I would like to enquire about a studio session.",
      )}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="pa-fab-anchor fixed right-[var(--pa-gutter)] z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:brightness-110"
      aria-label="Chat with Photo Arena on WhatsApp"
    >
      <WhatsAppIcon className="h-6 w-6" />
    </a>
  );
}

/** Sticky Book Now bar for phones — hidden on /book and desktop. */
export function MobileBookBar() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/book")) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 bg-ink px-gutter pt-eyebrow lg:hidden"
      style={{
        backgroundColor: "var(--pa-ink)",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div aria-hidden="true" className="nav-edge-up pointer-events-none absolute inset-x-0 bottom-full h-8" />
      <Link
        to="/book"
        className="flex min-h-11 w-full items-center justify-center rounded-xl bg-accent font-button text-sm font-normal text-text-on-accent hover:bg-accent-hover"
      >
        Book Now
      </Link>
    </div>
  );
}
