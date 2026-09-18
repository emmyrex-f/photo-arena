# Photo Arena — Architecture

**Status:** Implementation v1.1  
**Updated:** 2026-09-12  
**Scope:** Full-stack rebuild. Old project is read-only.

---

## 1. System overview

```text
Customer Browser
  → React public site (Vite)
  → NestJS API
  → PostgreSQL (Prisma)

Admin Browser
  → React admin routes
  → same API / database

External:
  Bachs (payments, abstracted)
  Email notifications
  Web3Forms (contact form, temporary)
  Future SMS channel (interface only)
```

Production target: VPS (Nginx + TLS + Node process + PostgreSQL).

---

## 2. Public information architecture

### Primary navigation

`Home | About | Services | Portfolio | Book Now | Contact`

### Routes

| Route | Page | Responsibility |
|---|---|---|
| `/` | Home | Hero, portfolio preview, services preview, booking CTA, optional testimonials |
| `/about` | About | Story, brand, studio experience, differentiators |
| `/services` | Services | Full catalogue, provisional pricing, package details, booking CTA |
| `/portfolio` | Portfolio | Full masonry gallery, filters, lightbox |
| `/book` | Book Now | Booking wizard + Bachs checkout |
| `/contact` | Contact | Address, hours, form, map, social |
| `/faq` | FAQ | Dedicated FAQ. Linked from footer and booking/services. |
| `/policies` | Policies | Non-refundable, no-show, reschedule rules |

Admin (later): `/admin/*`

Homepage must **not** contain the full FAQ, About, Services catalogue, or gallery.

---

## 3. Frontend architecture

```text
frontend/src/
  pages/                 thin route containers
  components/layout/     Navbar, Footer, SiteLayout
  components/home/       homepage sections only
  components/portfolio/  grid + lightbox (shared by preview and full)
  components/services/
  components/booking/
  components/contact/
  components/ui/         Button, Container, Section, Heading
  lib/theme.ts           design tokens
  data/                  provisional seed until API
```

Principles:

- React components. Do not port old vanilla JS.
- Real URLs and real links.
- Semantic design tokens. No scattered hex values.
- No emoji icons. Lucide SVGs with accessible labels.
- Lazy-loaded images. No base64 in the app.
- Accessible lightbox with focus trap and restoration.

---

## 4. Backend architecture

Modules: `auth`, `users`, `customers`, `services`, `packages`, `bookings`, `pricing`, `payments`, `notifications`, `gallery`, `settings`.

Backend is the source of truth for pricing, availability, booking status, payment status, and notification recipients.

---

## 5. Booking architecture

Confirmed:

- One location, one session at a time
- 30-minute slot increment
- No buffer
- Package occupies its full duration
- Same-day online booking with 2-hour minimum notice
- Online: 15-minute hold, confirm after Bachs success
- Walk-in: OWNER/ADMIN create `PENDING` reservation that blocks the slot
- `NO_SHOW` ≠ `CANCELLED`

See `BOOKING-FLOW.md`.

---

## 6. Payment architecture

See `PAYMENT-FLOW.md`.

```text
PaymentProvider
  ├── MockPaymentProvider
  └── BachsPaymentProvider
```

Never fake live Bachs payments. Never put secrets in the frontend.

---

## 7. Notification architecture

```text
NotificationChannel.send(message)
  ├── EmailChannel
  └── SmsChannel (future, no provider chosen)
```

Events: booking created, confirmed, reminder, rescheduled, cancelled, payment received, payment failed.

Recipients: two configurable emails, same content. Reminders at 24h and 2h.

---

## 8. Design tokens

Approved palette mapped to semantic roles (60-30-10):

| Role | Token | Hex |
|---|---|---|
| Dominant background | `--color-bg` | `#25272F` |
| Surface | `--color-surface` | `#30343D` |
| Elevated / border | `--color-elevated` | `#454B57` |
| Primary text | `--color-text` | `#F5F5F3` |
| Secondary text | `--color-text-secondary` | `#D9DCE2` |
| Muted text | `--color-text-muted` | `#AEB4BF` |
| Accent / CTA | `--color-accent` | `#C8B89A` |

Champagne is emphasis only. Photography stays the visual hero.

---

## 9. Database impact

Core models:

- `StudioResource` — one seeded “Main Studio”
- `Service`, `Package` — admin-editable, provisional seed prices
- `Customer`, `Booking` — source, status, start/end, resourceId
- `Payment` — separate from booking
- `PricingRule` — online discount 5%, reschedule 15%
- `NotificationRecipient`, `NotificationLog`
- `BusinessSettings` — hours, slot increment, hold duration, minimum notice
- `GalleryImage`

Availability is protected by a transaction plus overlap check. PostgreSQL exclusion constraint can be added later.

---

## 10. Security

- Password hashing for admin users
- JWT for admin
- Roles: OWNER, ADMIN, STAFF (walk-in create: OWNER + ADMIN)
- Server-side validation
- Webhook signature + idempotency
- `.env` only, never committed

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Double booking | Same availability engine + DB transaction |
| Price mismatch | Backend PricingService |
| Bachs key environment | Detect prefix; sandbox first |
| Missing hero video | Static image fallback |
| Unapproved testimonials | Hide section |
| Provisional prices | Mark in UI and seed data |
