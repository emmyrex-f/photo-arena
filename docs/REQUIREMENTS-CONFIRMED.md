# Photo Arena — Confirmed Business Requirements

**Date:** 2026-09-12  
**Status:** Confirmed by owner. Implementation started.

---

## Operating hours

- Open every day
- Monday–Saturday: 8:00 AM – 6:00 PM
- Sunday: 12:00 PM – 6:00 PM
- One physical location: 10 Prof Okujagu Street, off Peter Odili Road, Port Harcourt

---

## Booking capacity

- One client / session at a time
- 30-minute slot increment
- No buffer
- Package occupies full duration
- Same-day online booking allowed with 2-hour minimum notice
- Do not design for simultaneous sessions now
- Schema includes `StudioResource` so more rooms can be added later

---

## Booking / payment flows

### Online

booking → 15-minute hold → Bachs full payment minus 5% → confirmation

### Walk-in / future reservation

OWNER/ADMIN creates booking → `PENDING` → slot blocked → customer pays at studio → admin records payment → `CONFIRMED`

Not every booking requires online payment.

---

## Pricing

- Backend is the source of truth
- 5% online discount is a pricing rule, not a frontend constant
- Reschedule fee: 15%
- Bookings are non-refundable
- Old website prices are **provisional seed only**
- Admin can update services / packages / prices
- Do not invent new prices

---

## Statuses

`TEMPORARY_HOLD | PENDING | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW`

---

## Notifications

- Two configurable email recipients
- Same content for both
- Email now, SMS later via abstraction
- Reminders at 24 hours and 2 hours
- Events: created, confirmed, payment received, reminder, rescheduled, cancelled, payment failed

---

## Website information architecture

Primary nav: Home | About | Services | Portfolio | Book Now | Contact

Homepage:

1. Hero (video if available, else static image)
2. Portfolio preview (8 curated images, not full gallery)
3. Services preview
4. Studio tour video *(added 2026-09-13)*
5. Final booking CTA
6. Instagram strip *(added 2026-09-13)*
7. Testimonials only if published in admin
8. Footer (social icons: Instagram, Facebook, TikTok, WhatsApp · newsletter · legal links · cookie settings)

FAQ, full About, full Services, full Portfolio, Journal (blog), Privacy, Cookie Policy, and Terms live on their own pages.

Design: hybrid — ivory pages with deep-teal editorial sections and amber/champagne accents. Framer Motion reveals. No emoji icons. Playfair Display + Inter.

---

## Admin portal (CMS / CRM) — confirmed 2026-09-13

Modules: Dashboard · Bookings (day/week calendar + list, reschedule with 15% fee) · Customers (CRM: notes, tags, history, CSV) · Enquiries inbox · Services & pricing · Gallery manager (local-disk uploads) · Content (site settings, hero, tour, social links, SEO, analytics IDs, policies, testimonials, FAQ, Instagram strip, blog) · Payments (list, summary, CSV) · Notifications (recipients, reminders, logs, test send) · Users & roles · Audit log · Settings (light/dark theme, password).

---

## Cookies & privacy — confirmed 2026-09-13

Consent banner with Necessary / Analytics / Marketing. GA4 and Meta Pixel load only after consent and only when IDs are configured in admin. Legal pages: Privacy, Cookie Policy, Terms.

---

## Infrastructure

- Domain: photoarenang.com
- Hosting: VPS
- Contact form: Web3Forms for now
- Bachs API key received — detect sandbox vs live from prefix; do not paste the key
- Guest booking only
