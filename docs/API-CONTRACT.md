# Photo Arena — API Contract (v2 build)

**Status:** Binding for the current build. Backend implements exactly these routes/shapes; frontend (public + admin) consumes them.  
**Base URL:** `/api` (Vite proxies `/api` and `/uploads` to `http://localhost:3001`).  
**Auth:** Admin routes require `Authorization: Bearer <jwt>`. Roles: `OWNER | ADMIN | STAFF`. STAFF is read-only unless stated.  
**Money:** integer kobo everywhere (`amountKobo`, `priceKobo`). Currency `NGN`.  
**Time:** ISO-8601 UTC strings. Display in `Africa/Lagos`.  
**Errors:** Nest default `{ statusCode, message, error }`. `message` may be a string[] for validation.  
**Lists:** paginated endpoints return `{ items: T[], total: number, page: number, pageSize: number }`.

---

## 0. Data model additions (Prisma)

Existing models stay. Additions/changes:

```prisma
enum ServiceKind { SESSION SET BOOTH BACKDROP RENTAL }
enum EnquiryStatus { NEW REPLIED CLOSED }
enum MediaKind { GALLERY BLOG CONTENT }

model User            { + isActive Boolean @default(true), updatedAt DateTime @updatedAt, lastLoginAt DateTime? }
model Customer        { + notes String?, tags String[] @default([]), updatedAt DateTime @updatedAt }
model Service         { + kind ServiceKind @default(SESSION), sortOrder Int @default(0), summary String? (short card copy), createdAt/updatedAt }
model Package         { + sortOrder Int @default(0), createdAt/updatedAt }
model Booking         { + rescheduledFromId String?, amountKobo Int? (payable amount frozen at hold/creation), reference String? @unique (payment reference) }
model GalleryImage    { + url String (public path e.g. /uploads/gallery/abc.jpg), thumbUrl String?, width Int?, height Int?, kind MediaKind @default(GALLERY), createdAt }
model Testimonial     { id, quote String, name String, role String?, rating Int?, isPublished Boolean @default(false), sortOrder Int @default(0), createdAt, updatedAt }
model Faq             { id, question String, answer String, sortOrder Int @default(0), isActive Boolean @default(true), updatedAt }
model Enquiry         { id, name, email, phone String?, sessionType String?, message String, status EnquiryStatus @default(NEW), internalNote String?, createdAt, updatedAt }
model NewsletterSubscriber { id, email @unique, isActive Boolean @default(true), source String?, createdAt }
model BlogPost        { id, slug @unique, title, excerpt String, content String (markdown), coverImageUrl String?, tags String[] @default([]), isPublished Boolean @default(false), publishedAt DateTime?, authorId String?, createdAt, updatedAt }
model AuditLog        { id, userId String?, userEmail String, action String, entity String, entityId String?, meta Json?, createdAt }
model BusinessSettings (existing key/value) — used as the settings store. `value` is a string; JSON values are stored as JSON strings.
```

Use `npx prisma db push` during development (no migrations dir exists yet). Seed via `npm run prisma:seed`.

### Settings keys (BusinessSettings)

Public-safe keys are prefixed with `site.`, `social.`, `hero.`, `tour.`, `instagram.`, `analytics.`, `seo.`. Everything else is admin-only.

| Key | Example | Notes |
|---|---|---|
| `site.name` | `Photo Arena` | |
| `site.tagline` | `Port Harcourt's premier walk-in portrait studio.` | |
| `site.phone` | `09059813823` | |
| `site.email` | `photoarenang@gmail.com` | |
| `site.whatsapp` | `https://api.whatsapp.com/send/?phone=2349059813823` | |
| `site.address` | `10 Prof Okujagu Street, off Peter Odili Road, Port Harcourt` | |
| `site.hours.weekday` | `8:00 AM – 6:00 PM` | Mon–Sat |
| `site.hours.sunday` | `12:00 PM – 6:00 PM` | |
| `site.mapEmbed` | OSM embed URL | |
| `social.instagram` | URL | |
| `social.facebook` | URL | |
| `social.tiktok` | URL (empty until owner supplies) | |
| `hero.headline` | `Where every shot becomes a masterpiece` | |
| `hero.subheadline` | text | |
| `hero.videoUrl` | `/LANDSCAPE.mp4` | |
| `tour.heading` / `tour.body` / `tour.videoUrl` | `/video_mp4.mp4` | studio tour section |
| `instagram.items` | JSON `[{ "image": "/gallery/01-birthdays.jpg", "href": "https://instagram.com/p/..." }]` | Instagram strip (static for now) |
| `analytics.ga4Id` | `G-XXXX` | loaded only after consent |
| `analytics.metaPixelId` | `123...` | loaded only after consent |
| `seo.defaultTitle` / `seo.defaultDescription` / `seo.ogImage` | | |
| `booking.slotIncrementMinutes` etc. | existing seeded keys | admin-only |
| `notifications.recipients` | `a@x.com,b@y.com` | admin-only |
| `notifications.reminder24h` / `notifications.reminder2h` | `true` | admin-only |
| `policies.*` | e.g. `policies.vatPercent=7.5`, `policies.expressPercent=30`, `policies.extraImageKobo=300000`, `policies.accompanyingMax=1`, `policies.deliveryDays=3-4 working days` | public-safe (prefix `policies.` is public) |

---

## 1. Public endpoints (no auth)

### Content
| Method | Path | Response |
|---|---|---|
| GET | `/public/settings` | `Record<string,string>` — only public-safe prefixes (`site.`, `social.`, `hero.`, `tour.`, `instagram.`, `analytics.`, `seo.`, `policies.`) |
| GET | `/public/services` | `Service[]` with `packages: Package[]` (active only, ordered by `sortOrder`). Service fields: `id, slug, name, kind, summary, description, startingPriceKobo, isProvisional, sortOrder, media: { id, url, thumbUrl, alt } \| null`, packages[{ id, name, durationMinutes, includes, priceKobo, isProvisional, sortOrder }]` |
| GET | `/public/gallery` | `GalleryImage[]` where `isActive && kind=GALLERY`, ordered by `sortOrder`. Fields: `id, url, thumbUrl, alt, category, featured, width, height, sortOrder, media: { id, url, thumbUrl, alt } \| null`. `url`/`thumbUrl`/`alt` resolve from MediaUsage (`usageType=portfolio`) when an active overlay is attached; otherwise the GalleryImage’s own file (existing fallback). |
| GET | `/public/testimonials` | `Testimonial[]` where `isPublished`, ordered |
| GET | `/public/faqs` | `Faq[]` where `isActive`, ordered |
| GET | `/public/blog?page=1&pageSize=9&tag=` | paginated `BlogPost` (published only; `content` omitted in list) |
| GET | `/public/blog/:slug` | full `BlogPost` (published only) |
| POST | `/public/enquiries` | body `{ name, email, phone?, sessionType?, message, botcheck? }` → `{ id }`. If `botcheck` non-empty, return `{ id: "ok" }` and store nothing. |
| POST | `/public/newsletter` | body `{ email, source? }` → `{ ok: true }` (idempotent) |

### Booking flow (guest)
| Method | Path | Body / Response |
|---|---|---|
| GET | `/bookings/availability?date=YYYY-MM-DD&durationMinutes=60` | existing → `{ rules, date, durationMinutes, slots: string[] }` |
| GET | `/bookings/packages` | same as `/public/services` (alias) |
| POST | `/bookings/hold` | body `{ packageId, startTime(ISO), customerName, customerPhone, customerEmail }` → `{ bookingId, reference, status: "TEMPORARY_HOLD", holdExpiresAt, startTime, endTime, package: { id, name, durationMinutes }, pricing: { baseKobo, discountKobo, payableKobo, discountPercent } }`. Creates booking `TEMPORARY_HOLD` (15 min), source `ONLINE`, `amountKobo` = payable. 409 if slot taken. |
| POST | `/bookings/:id/checkout` | body `{ reference, returnUrl, cancelUrl }` (no amount/currency — extra fields → 400) → `{ provider: "mock" \| "bachs", checkoutUrl, reference }`. Amount is the frozen `Booking.amountKobo`. `reference` must match the booking; `returnUrl`/`cancelUrl` must be on a `PUBLIC_SITE_ORIGINS` origin and an allowed path (`/book/confirmation`, `/book`). Creates `Payment` (PROCESSING, method ONLINE_BACHS, provider, `providerSessionId` = Bachs `checkout_id`). 400 bad reference/URL · 410 hold expired · 409 provider already has a session for this reference · 502 provider unavailable. |
| GET | `/bookings/:id/status` | `{ id, reference, status, startTime, endTime, holdExpiresAt, package: { name, durationMinutes }, customer: { name, email }, amountKobo, payment: { status, method, provider, paidAt } \| null }` — limited public view |
| GET | `/payments/verify?reference=` | server-side verification with the provider (`GET /v1/checkout-sessions/{checkout_id}`); on paid + matching amount/currency marks Payment SUCCESS + Booking CONFIRMED (or `PAID_UNPLACED` if the slot is gone); returns same shape as status. Never trusts the browser redirect. |
| POST | `/payments/mock/complete` | body `{ reference }` — **only when `PAYMENTS_MOCK=true` and `NODE_ENV !== production`**. Marks success. 403 otherwise. |
| POST | `/payments/webhook/bachs` | raw body + `X-Bachs-Signature-V2` (preferred) or `X-Bachs-Signature` + `X-Bachs-Timestamp` → `{ received: true }`, `{ received: true, duplicate: true }` or `{ received: true, ignored: "amount_mismatch" }`. 401 bad/stale/missing signature. Verifies HMAC over the raw body, dedupes by event `id` (`ProcessedWebhookEvent`), confirms on `collection.succeeded` (and `checkout.completed` with `payment_status: "paid"`) only when `data.amount`/`data.currency` equal the frozen Payment; `collection.failed` → Payment FAILED; `collection.underpaid` / `checkout.expired` / `refund.paid` acknowledged only. |

Hold expiry: a scheduled job (`@nestjs/schedule`, every minute) sets expired `TEMPORARY_HOLD` bookings to `CANCELLED` (they are already non-blocking once expired).

---

## 2. Admin endpoints (JWT)

### Auth
| Method | Path | Notes |
|---|---|---|
| GET | `/auth/desk-email` | public → `{ email }` — the single studio login email |
| POST | `/auth/login` | `{ email, password }` — `email` must be the studio email; `password` selects OWNER (full access) or that ADMIN’s stored areas |
| GET | `/auth/me` | existing |
| POST | `/auth/change-password` | body `{ currentPassword, newPassword }` |
| PATCH | `/auth/account` | OWNER only. Body `{ currentPassword, name?, email?, newPassword? }` → `{ user, token? }`. `email` is the studio desk login. `token` is returned when the password changes. |

### Dashboard
`GET /admin/dashboard` →
```json
{
  "today": { "date": "2026-09-13", "bookings": [BookingRecord], "count": 3 },
  "counts": { "pendingPayments": 2, "activeHolds": 1, "upcoming7d": 12, "newEnquiries": 4, "customers": 120 },
  "revenue": { "todayKobo": 0, "weekKobo": 0, "monthKobo": 0 },
  "series": [{ "date": "2026-08-15", "bookings": 2, "revenueKobo": 12000000 }],   // last 30 days
  "recentEnquiries": [Enquiry],   // 5 newest
  "recentPayments": [Payment]     // 5 newest with booking.customer
}
```

### Bookings
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/packages` | existing (all active packages with service) |
| GET | `/admin/availability?date&durationMinutes` | existing |
| GET | `/admin/bookings?date=` | existing (day) |
| GET | `/admin/bookings/range?from=YYYY-MM-DD&to=YYYY-MM-DD&status=&q=` | list for calendar views (inclusive dates, Lagos) |
| GET | `/admin/bookings/:id` | existing |
| POST | `/admin/bookings` | existing (OWNER/ADMIN) |
| POST | `/admin/bookings/:id/payment` | existing — body optional `{ amountKobo?, note? }` |
| PATCH | `/admin/bookings/:id/status` | existing |
| PATCH | `/admin/bookings/:id` | body `{ notes? }` |
| POST | `/admin/bookings/:id/reschedule` | body `{ startTime }` → new time, records 15% `RESCHEDULE_FEE` as a pending Payment line (method STUDIO, status PENDING) and audit log. OWNER/ADMIN |

`BookingRecord` = booking with `customer`, `package.service`, `payments`.

### Customers (CRM)
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/customers?q=&page=&pageSize=&tag=` | paginated; each item includes `bookingCount`, `lastBookingAt`, `totalPaidKobo` |
| GET | `/admin/customers/:id` | customer + `bookings` (with package, payments) |
| PATCH | `/admin/customers/:id` | body `{ name?, email?, notes?, tags? }` OWNER/ADMIN |
| GET | `/admin/customers/export.csv` | CSV download |

### Enquiries
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/enquiries?status=&page=` | paginated |
| PATCH | `/admin/enquiries/:id` | body `{ status?, internalNote? }` |
| DELETE | `/admin/enquiries/:id` | OWNER/ADMIN |

### Services & pricing (OWNER/ADMIN for writes)
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/services` | all services (incl. inactive) with packages and `media: { id, url, thumbUrl, alt, filename, isActive } \| null` |
| POST | `/admin/services` | `{ slug?, name, kind, summary?, description, startingPriceKobo, isActive?, isProvisional?, mediaId? }` — `mediaId` attaches one primary MediaUsage (`usageType=service`) |
| PATCH | `/admin/services/:id` | partial; `mediaId` replaces primary usage, `mediaId: null` detaches (does not delete GalleryImage) |
| DELETE | `/admin/services/:id` | soft (isActive=false) if bookings exist, else hard |
| POST | `/admin/services/reorder` | `{ ids: string[] }` |
| POST | `/admin/services/:id/packages` | `{ name, durationMinutes, includes, priceKobo, isActive?, isProvisional? }` |
| PATCH | `/admin/packages/:id` | partial |
| DELETE | `/admin/packages/:id` | soft if bookings exist |
| POST | `/admin/packages/reorder` | `{ ids: string[] }` |
| GET | `/admin/pricing-rules` / `PATCH /admin/pricing-rules/:key` | `{ bps, isActive }` |

### Gallery / media (uploads to local disk)
Files saved under `backend/uploads/<kind>/<uuid>.<ext>`, served statically at `/uploads/...`. Generate a `thumbUrl` (max 800px) with `sharp`; record `width/height`.

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/gallery?kind=GALLERY` | all (incl. inactive), ordered |
| POST | `/admin/gallery/upload` | multipart `files[]` (+ fields `kind?`, `category?`, `alt?`) → `GalleryImage[]`. Max 10 files, 15 MB each, image/* only |
| PATCH | `/admin/gallery/:id` | `{ alt?, category?, featured?, isActive?, sortOrder?, mediaId? }` — `mediaId` on a `kind=GALLERY` item sets one primary MediaUsage (`usageType=portfolio`, `entityId=GalleryImage.id`); `mediaId: null` detaches (does not delete GalleryImage) |
| DELETE | `/admin/gallery/:id` | removes file(s) too |
| POST | `/admin/gallery/reorder` | `{ ids: string[] }` |

### Content (CMS)
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/settings` | all keys `Record<string,string>` |
| PUT | `/admin/settings` | body `Record<string,string>` (upsert each). OWNER/ADMIN |
| GET/POST | `/admin/testimonials` | `{ quote, name, role?, rating?, isPublished?, sortOrder? }` |
| PATCH/DELETE | `/admin/testimonials/:id` | |
| POST | `/admin/testimonials/reorder` | `{ ids }` |
| GET/POST | `/admin/faqs` | `{ question, answer, isActive?, sortOrder? }` |
| PATCH/DELETE | `/admin/faqs/:id` | |
| POST | `/admin/faqs/reorder` | `{ ids }` |
| GET | `/admin/blog?page=&q=` | paginated, all posts |
| GET | `/admin/blog/:id` | |
| POST | `/admin/blog` | `{ title, slug?, excerpt, content, coverImageUrl?, tags?, isPublished? }` |
| PATCH/DELETE | `/admin/blog/:id` | publishing sets `publishedAt` if null |

### Payments
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/payments?from=&to=&status=&method=&page=` | paginated, includes `booking.customer`, `booking.package` |
| GET | `/admin/payments/export.csv?from=&to=` | CSV |
| GET | `/admin/payments/summary?from=&to=` | `{ totalKobo, count, byMethod: { STUDIO: kobo, ONLINE_BACHS: kobo } }` |
| GET | `/admin/payments/integration` | Bachs connection status (no secrets): provider, environment, webhookUrl, readyForLive, … |

### Notifications
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/notifications/settings` | `{ recipients: string[], reminder24h: boolean, reminder2h: boolean, smtpConfigured: boolean, fromAddress }` |
| PUT | `/admin/notifications/settings` | `{ recipients, reminder24h, reminder2h }` OWNER/ADMIN |
| GET | `/admin/notifications/logs?page=` | paginated `NotificationLog` |
| POST | `/admin/notifications/test` | sends a test email to recipients (or logs if SMTP not configured) |
| GET | `/admin/notifications/templates` | `[{ event, subject, bodyPreview }]` — current default templates (read-only) |

Email channel: if `SMTP_HOST` set → nodemailer; else log to `NotificationLog` with channel `email:dry-run`. Recipients come from settings `notifications.recipients` (fallback env `NOTIFICATION_EMAIL_RECIPIENTS`). Events sent: `booking_created` (hold+PENDING), `booking_confirmed`, `payment_received`, `booking_cancelled`, `booking_rescheduled`, `payment_failed`, reminders (24h/2h via scheduler; log only once per booking per type — store sent markers in `NotificationLog`).

### Users (OWNER only for writes; ADMIN can list if granted Users access)
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/users` | `{ id, email, name, role, permissions, isActive, lastLoginAt, createdAt }[]` |
| POST | `/admin/users` | `{ email, name, role, password, fullAccess?, permissions? }` — ADMIN: `fullAccess: true` (or `permissions: ["*"]`) = entire desk; otherwise `permissions` is the allowed area list |
| PATCH | `/admin/users/:id` | `{ name?, role?, isActive?, fullAccess?, permissions? }` (cannot demote/deactivate last OWNER or self) |
| POST | `/admin/users/:id/reset-password` | `{ password }` |
| DELETE | `/admin/users/:id` | permanent delete for ADMIN/STAFF (not last/self OWNER) |

### Audit log
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/audit?page=&entity=&q=` | paginated, newest first |

Every admin write (bookings, payments, services, packages, gallery, settings, testimonials, faqs, blog, users, enquiries, customers) writes an `AuditLog` row: `action` like `booking.create`, `service.update`, `settings.update`, `user.reset_password`; `meta` = changed fields (never passwords).

### Newsletter
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/newsletter?page=` | paginated |
| DELETE | `/admin/newsletter/:id` | |
| GET | `/admin/newsletter/export.csv` | |

---

## 3. Frontend contracts

- Public site reads `GET /public/settings` once on load (context `SiteSettingsProvider`) and falls back to `src/lib/site.ts` defaults when a key is missing or the API is down. **The site must render fully with the API offline.**
- Public services/gallery/testimonials/faqs come from the API with the same offline fallback to `src/data/*`.
- Cookie consent state stored in `localStorage` key `pa_cookie_consent` = `{ necessary: true, analytics: boolean, marketing: boolean, decidedAt }`. GA4/Meta scripts load only when the respective flag is true and an ID exists in settings.
- Admin stores JWT in `sessionStorage` (`pa_admin_token`, `pa_admin_user`) — existing `src/lib/auth.tsx`.
- Admin theme preference in `localStorage` key `pa_admin_theme` = `light | dark | system`.
