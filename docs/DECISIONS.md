# Photo Arena — Architecture Decisions

**Updated:** 2026-09-12  
**Status:** Active

Decisions below are locked unless the owner changes them. Temporary defaults are marked.

---

## Confirmed business decisions

| ID | Decision | Source |
|---|---|---|
| D-01 | Open every day. Mon–Sat 08:00–18:00. Sunday 12:00–18:00. | Owner |
| D-02 | One physical location. One session at a time. | Owner |
| D-03 | Slot increment is 30 minutes. No buffer between sessions. | Owner |
| D-04 | A booked package occupies its full duration. | Owner |
| D-05 | Same-day online booking is allowed with 2 hours minimum notice. | Owner |
| D-06 | Online customers pay the full amount minus a 5% backend-calculated discount. | Owner |
| D-07 | Selecting an online slot creates a 15-minute temporary hold. Confirmation happens only after successful Bachs payment. | Owner |
| D-08 | Walk-in / future reservations start as `PENDING`. Staff records payment later. | Owner |
| D-09 | Only OWNER and ADMIN may create walk-in / future reservations. | Owner |
| D-10 | Bookings are non-refundable. Customers cannot self-cancel. Admin handles exceptions. | Owner |
| D-11 | Rescheduling attracts a 15% additional charge. | Owner |
| D-12 | `NO_SHOW` is a distinct status from `CANCELLED`. | Owner |
| D-13 | Two configurable email recipients receive the same notification content. | Owner |
| D-14 | Appointment reminders: 24 hours and 2 hours before the session. Email now, SMS later via an abstraction. | Owner |
| D-15 | Guest booking only. No customer accounts at launch. | Owner |
| D-16 | Legal / brand name: Photo Arena. Domain: photoarenang.com. | Owner |
| D-17 | Address: 10 Prof Okujagu Street, off Peter Odili Road, Port Harcourt. | Owner |
| D-18 | Hosting: VPS. Contact form: keep Web3Forms for now. | Owner |
| D-19 | Old website prices are provisional seed data only. Admin can update prices. Do not invent new prices. | Owner |
| D-20 | Testimonials must be real and approved. Do not fabricate. Hide the homepage section until approved. | Owner / IA |

---

## Information architecture

| ID | Decision |
|---|---|
| D-21 | Primary nav: Home, About, Services, Portfolio, Book Now, Contact. |
| D-22 | Homepage is a conversion page: Hero → Portfolio preview (8 curated) → Services preview → Studio tour video → Booking CTA → Instagram strip → Testimonials (only when published in admin) → Footer. *(Updated 2026-09-13: studio tour + Instagram strip added by owner.)* |
| D-23 | Full FAQ, About, Services catalogue, and gallery live on dedicated pages. FAQ is `/faq`, linked from footer and booking/services. |
| D-24 | Why Us / differentiators live on About, not Home. |
| D-25 | Packages are shown on Services, not a separate public nav item. Services are grouped by kind: sessions, signature sets, booths, backdrops, studio rental (ported from old site as provisional). |
| D-26 | Footer carries Instagram, Facebook, TikTok, WhatsApp icons. Links are editable in admin (`social.*`). TikTok renders disabled until the owner supplies the URL. |
| D-27 | Legal pages: `/privacy`, `/cookies`, `/terms`. Cookie consent banner with Necessary / Analytics / Marketing categories; GA4 and Meta Pixel load only after consent and only when IDs are set in admin. |
| D-28 | Journal (blog) exists at `/blog`, CMS-managed, linked from footer only. Newsletter signup in footer stores emails in the database (no email provider yet). |
| D-29 | Old-site policy lines are adopted as provisional settings (`policies.*`): 7.5% VAT, express +30%, extra edited image ₦3,000, max 1 accompanying person, promo-usage consent, delivery 3–4 working days. Editable in admin. |

---

## Technical decisions

| ID | Decision | Rationale |
|---|---|---|
| T-01 | React + Vite + TypeScript frontend | Component model, real URLs, type safety |
| T-02 | Tailwind mapped to semantic design tokens | No scattered hex values |
| T-03 | NestJS + Prisma + PostgreSQL | Structured modules, transaction-safe bookings |
| T-04 | Backend `PricingService` is the source of truth | Prevent frontend price tampering |
| T-05 | Single availability engine for online and admin bookings | Prevent walk-in vs online conflicts |
| T-06 | `StudioResource` with one seeded “Main Studio” | Simple today, extendable later |
| T-07 | Payment provider interface + Mock + Bachs adapter | Do not fake live Bachs charges |
| T-08 | Notification channel interface (email now, SMS later) | Recipients configurable, no SMS vendor lock-in |
| T-09 | Amounts stored as integer kobo internally; Bachs adapter converts to decimal strings | Bachs docs: money is a decimal string, not minor units |
| T-10 | Times stored in UTC, displayed as Africa/Lagos | Avoid timezone bugs |
| T-11 | Lucide SVG icons, no emoji UI icons | Accessibility and brand restraint |
| T-12 | Playfair Display + Inter | Confirmed typography |
| T-13 | Extract old-site gallery images as files; no base64 in the new app | Performance and cacheability |
| T-14 | Hero uses `LANDSCAPE.mp4` if provided; otherwise a static image | File is missing from the old repo |
| T-15 | VPS + Nginx + Let’s Encrypt for production | Owner hosting preference |
| T-16 | Do not modify `photo arena old/` | Read-only reference |
| T-17 | Visual direction: hybrid — ivory pages, deep-teal editorial sections, amber/champagne accents. Framer Motion for reveals and micro-interactions, honouring `prefers-reduced-motion`. | Owner choice 2026-09-13 |
| T-18 | Admin portal uses shadcn/ui-style components (Radix + cva + Tailwind) hand-authored under `frontend/src/admin/components/ui`, scoped theme tokens in `admin.css` with light/dark mode. Public `accent` token is the brand amber; admin components use `muted` for hover states. | Consistent, accessible admin UI |
| T-19 | Admin uploads are stored on the VPS local disk (`backend/uploads/`), served at `/uploads/*`; thumbnails generated with sharp. | Matches VPS hosting, no third-party storage |
| T-20 | `docs/API-CONTRACT.md` is the binding interface between backend, public site, and admin. | Parallel development |
| T-21 | Public site must render fully with the API offline: settings/services/gallery/FAQ fall back to `src/lib/site.ts` and `src/data/*`. | Resilience |
| T-22 | Online booking flow runs end-to-end against the Mock provider (and Bachs sandbox adapter when a sandbox key is set). No live charges until the key prefix is verified. | Safe development |

---

## Temporary defaults still awaiting production confirmation

| Area | Temporary default | Blocks |
|---|---|---|
| Final price list | Old-site prices, marked provisional | Production pricing |
| Notification emails | Env/settings placeholders | Live notifications |
| Exact customer email/SMS copy | Standard confirmation + reminder templates | Notification content |
| Bachs environment | Detect from key prefix (`sk_sandbox_` vs `sk_live_`). Build against sandbox until verified. | Live payments |
| Portfolio preview count | 8 curated images | Visual polish only |
| Testimonials | Old-site quotes seeded as unpublished drafts; section hidden until owner publishes in admin | Homepage testimonials |
| TikTok URL | Empty; footer icon disabled | Social links |
| GA4 / Meta Pixel IDs | Empty; scripts never load | Analytics |
| Studio tour video | `video_mp4.mp4` from project root copied to `frontend/public/tour.mp4` | Confirm this is the intended tour footage |
