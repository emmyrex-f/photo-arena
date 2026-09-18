import { Link } from "react-router-dom";
import { Clock, Facebook, Instagram, Mail, MapPin, Phone } from "lucide-react";
import { TikTokIcon } from "../icons/TikTokIcon";
import { WhatsAppIcon } from "../icons/WhatsAppIcon";
import { exploreLinks, legalLinks } from "../../lib/site";
import { useSiteInfo } from "../../lib/settings";

export function Footer() {
  const info = useSiteInfo();

  return (
    <footer className="tone-dark">
      <div className="mx-auto grid max-w-site gap-stack-lg px-gutter py-footer-y md:grid-cols-2 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <Link to="/" className="inline-block">
            <img src="/logo.png" alt="" className="h-11 w-auto" />
            <span className="sr-only">{info.name}</span>
          </Link>
          <p className="mt-eyebrow max-w-xs text-sm leading-relaxed text-text-secondary">{info.tagline}</p>
          <div className="mt-eyebrow flex flex-wrap items-center gap-control">
            {info.instagram ? (
              <a
                href={info.instagram}
                className="text-text-secondary hover:text-accent"
                target="_blank"
                rel="noreferrer"
              >
                <Instagram className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Instagram</span>
              </a>
            ) : null}
            {info.facebook ? (
              <a
                href={info.facebook}
                className="text-text-secondary hover:text-accent"
                target="_blank"
                rel="noreferrer"
              >
                <Facebook className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Facebook</span>
              </a>
            ) : null}
            {info.tiktok ? (
              <a
                href={info.tiktok}
                className="text-text-secondary hover:text-accent"
                target="_blank"
                rel="noreferrer"
              >
                <TikTokIcon className="h-4 w-4" />
                <span className="sr-only">TikTok</span>
              </a>
            ) : (
              <span className="cursor-not-allowed text-text-muted opacity-40" title="TikTok coming soon" aria-disabled>
                <TikTokIcon className="h-4 w-4" />
                <span className="sr-only">TikTok unavailable</span>
              </span>
            )}
            {info.whatsapp ? (
              <a
                href={info.whatsapp}
                className="text-text-secondary hover:text-accent"
                target="_blank"
                rel="noreferrer"
              >
                <WhatsAppIcon className="h-4 w-4" />
                <span className="sr-only">WhatsApp</span>
              </a>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-3">
          <p className="mb-eyebrow text-xs uppercase tracking-[0.18em] text-accent">Visit</p>
          <p className="flex items-start gap-2 text-sm text-text-secondary">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <span>{info.address}</span>
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
            <Phone className="h-4 w-4 text-accent" aria-hidden="true" />
            <a href={info.phoneHref}>{info.phone}</a>
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
            <Mail className="h-4 w-4 text-accent" aria-hidden="true" />
            <a href={info.emailHref}>{info.email}</a>
          </p>
        </div>

        <div className="lg:col-span-2">
          <p className="mb-eyebrow text-xs uppercase tracking-[0.18em] text-accent">Hours</p>
          <ul className="space-y-2 text-sm text-text-secondary">
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span>
                Mon–Sat {info.hoursWeekday}
                <br />
                Sunday {info.hoursSunday}
              </span>
            </li>
          </ul>
        </div>

        <div className="lg:col-span-2">
          <p className="mb-eyebrow text-xs uppercase tracking-[0.18em] text-accent">Explore</p>
          <ul className="space-y-1.5 text-sm">
            {exploreLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-text-secondary hover:text-text">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2">
          <p className="mb-eyebrow text-xs uppercase tracking-[0.18em] text-accent">Legal</p>
          <ul className="space-y-1.5 text-sm">
            {legalLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-text-secondary hover:text-text">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="px-gutter pb-stack-lg text-center text-xs text-text-muted">
        © {new Date().getFullYear()} {info.name}. Port Harcourt, Nigeria. All rights reserved.
      </div>
    </footer>
  );
}
