# Photo Arena — Production Gap Audit & Remediation Tracking
> Codebase Audit & Gap Tracking · Updated: 2026-09-25 · Auth → Payment → Infrastructure

---

## Status Legend
- ✅ **RESOLVED / VERIFIED** — Implemented, reviewed, and covered by automated test suites.
- 🔴 **BLOCKER** — Must be resolved prior to production launch.
- 🟡 **HIGH** — High priority before public customer traffic.
- 🟢 **MEDIUM / ENHANCEMENT** — Post-launch improvements or optimizations.
- ⚪ **DEPRECATED / EXCLUDED** — Out of scope or explicitly retired per client directive.

---

## Executive Summary (2026-09-25 code pass)

Method: read the current source. Verify scripts were not re-run. Rows below that say resolved were closed by code that exists now; earlier “resolved” rows were not re-executed.

| Category | Total Gaps | ✅ Resolved | 🔴 Blocker | 🟡 High | 🟢 Medium | ⚪ Deprecated |
|---|---|---|---|---|---|---|
| **1. Authentication & Access** | 6 | **4** (A1, A2, A3, A6) | 0 | 1 (A4) | 1 (A5) | 0 |
| **2. Booking Engine** | 8 | **7** (B1–B7) | 0 | 0 | 1 (B8) | 0 |
| **3. Payments & Accounting** | 8 | **6** (P1–P5, P7) | 0 | 0 | 1 (P8) | **1 (P6)** |
| **4. Notifications & Email** | 6 | **6** (N1–N6) | 0 | 0 | 0 | 0 |
| **5. Media & File Storage** | 4 | **4** (M1–M4) | 0 | 0 | 0 | 0 |
| **6. Admin CMS & Content** | 8 | **6** (C1–C6) | 0 | 0 | 2 (C7, C8) | 0 |
| **7. Public Website & UX** | 8 | **4** (W2–W4, W6) | 0 | 2 (W1, W5) | 2 (W7, W8) | 0 |
| **8. Security & Hardening** | 5 | **2** (S1, S4) | 0 | 2 (S2, S3) | 1 (S5) | 0 |
| **ACTIVE APPLICATION TOTALS** | **53** | **39** | **0** | **5** | **8** | **1** |
| *[OMITTED] Deployment & Ops (D1–D11)* | *11* | *0* | *Excluded from current scope* | *—* | *—* | *—* |

---

## 1. Authentication & Access

| # | Status | Feature | Detail & Resolution |
|---|---|---|---|
| **A1** | ✅ **RESOLVED** | **Password-reset / Forgot-password flow** | **Implemented 2026-09-25.**<br>• Model: `PasswordResetToken` (SHA-256 hash, 60-min TTL, single-use `usedAt` flag).<br>• Backend: `POST /auth/forgot-password` (enumeration-safe), `GET /auth/verify-reset-token`, `POST /auth/reset-password`.<br>• Email: Sends branded dark/gold HTML email via **Resend** with secure token link.<br>• Frontend: `/admin/forgot-password` and `/admin/reset-password?token=...` with responsive UI and strength checks.<br>• Verified: 10/10 automated tests passing in `backend/scripts/verify-auth-features.ts`. |
| **A2** | ✅ **RESOLVED** | **Logout-all-sessions / Token revocation** | **Implemented 2026-09-25.**<br>• Mechanism: `tokenVersion` on `User` model incremented on call; `jwt-auth.guard.ts` rejects any JWT with `payload.ver !== user.tokenVersion`.<br>• Backend: `POST /auth/revoke-sessions` (caller) & `POST /admin/users/:id/revoke-sessions` (OWNER).<br>• Frontend: "Sign out all devices" action in header profile menu (`AdminLayout.tsx`) and "Revoke sessions" in user table (`AdminUsersPage.tsx`).<br>• Verified: Automated tests verify instant invalidation of existing JWTs across multiple tokens. |
| **A3** | ✅ **RESOLVED** | **Remember Me / Persistent Storage** | **Implemented 2026-09-25.**<br>• Engine: Dual-storage in `frontend/src/lib/auth.tsx`. Checked = `localStorage`, Unchecked = `sessionStorage`.<br>• UI: "Remember me for 30 days" checkbox on `/admin/login` (`AdminLoginPage.tsx`).<br>• Security: Logout / revocation completely sweeps both storage engines clean (`pa_admin_token`, `pa_admin_user`, `pa_admin_storage`). |
| **A4** | 🟡 HIGH | Admin 2FA / MFA | Single password login currently. Recommended: TOTP / Authenticator app QR pairing or email OTP. |
| **A5** | 🟢 MEDIUM | In-memory rate limiter | Single-process memory Map in `rate-limit.ts`. Acceptable for single VPS; migrate to Redis for horizontal scaling. |
| **A6** | ✅ **RESOLVED** | **Admin / Staff email & profile editing** | **Implemented 2026-09-25.**<br>• Backend: `PATCH /auth/account` unlocked for all authenticated desk users with current password verification (`currentPassword`). Returns fresh JWT token and updated user.<br>• User Management: `PATCH /admin/users/:id` permission updated to allow admins to edit their own user record while protecting owner privileges and role assignments.<br>• Frontend: Added `EditProfileDialog.tsx` modal accessible directly from the header account dropdown menu across all admin desk pages, plus inline self-editing in `AdminUsersPage.tsx`.<br>• Session State: `applyAccount` updates in-memory React state and persistent storage (`localStorage`/`sessionStorage`) immediately without requiring re-login.<br>• Verified: 10/10 automated tests in `backend/scripts/verify-admin-email-edit.ts`. |

---

## 2. Booking Engine

| # | Status | Feature | Detail & Resolution |
|---|---|---|---|
| **B1** | ✅ **RESOLVED** | **CMS-driven opening hours (CMS-2)** | **Implemented 2026-09-25.**<br>• Engine: Added `parseOpeningHours` in `availability.ts` supporting 12h/24h formats, custom spans, and "Closed" states.<br>• Integration: `BookingsService.availability()`, `hold()`, `createAdmin()`, and `reschedule()` read `site.hours.weekday` and `site.hours.sunday` from `BusinessSettings`.<br>• Protection: When studio is marked Closed, availability returns 0 slots and holds/bookings are blocked with 409 Conflict.<br>• Verified: Automated test suite verifies live Sunday close and custom span constraints (`verify-booking-features.ts`). |
| **B2** | ✅ **RESOLVED** | **Phone number validation on booking form** | **Implemented 2026-09-25.**<br>• Frontend: Added `validateBookingPhone` in `BookPage.tsx` with Nigerian mobile (`070/080/081/090/091...`), international (`+234...`), real-time on-blur validation, helper text, and accessible error states.<br>• Backend: Added `IsValidPhoneConstraint` on `HoldBookingDto` and `CreateAdminBookingDto` strictly enforcing digit count and telephone grammar.<br>• Verified: Invalid formats (letters, short numbers, symbols) strictly rejected by API and UI (`verify-booking-features.ts`). |
| **B3** | ✅ **RESOLVED** | **Customer duplicate booking guard** | **Implemented 2026-09-25.**<br>• Guard: Transactional check in `BookingsService.hold()` verifies customer doesn't already hold an active `TEMPORARY_HOLD` or `CONFIRMED` booking for the identical start time.<br>• Outcome: Simultaneous duplicate hold by same customer rejected with 409 Conflict.<br>• Verified: Automated test in `verify-booking-features.ts`. |
| **B4** | ✅ **RESOLVED** | **Configurable hold duration** | **Implemented 2026-09-25.**<br>• Settings: `BookingsService.getHoldDurationMinutes()` reads `site.booking.holdMinutes` from `BusinessSettings` with fallback to 15 minutes.<br>• Verified: Live dynamic hold expiration calculation. |
| **B5** | ✅ **RESOLVED** | **Customer self-service booking lookup** | **Implemented 2026-09-25.**<br>• Public `/booking/lookup` page and backend `POST /bookings/customer-lookup` allow customers to view sanitized booking status, schedule details, and no-refund policy breakdown using their reference (`PA-XXXXXXXX`).<br>• Verified: Automated test in `verify-booking-self-service.ts`. |
| **B6** | ✅ **RESOLVED** | **Customer online cancellation request** | **Implemented 2026-09-25.**<br>• Backend `POST /bookings/customer-cancel` processes customer cancellations under strict no-refund rules.<br>• Verified: Automated test in `verify-booking-self-service.ts`. |
| **B7** | ✅ **RESOLVED** | **Reschedule fee payment handling** | **Implemented 2026-09-25.**<br>• Backend `POST /bookings/customer-reschedule` calculates 15% reschedule fee, creates pending fee payment, and sends updated notifications.<br>• Verified: Automated test in `verify-booking-self-service.ts`. |
| **B8** | 🟢 MEDIUM | Date picker UX | Currently `<select>` of 28 days forward; consider interactive calendar grid widget. |

---

## 3. Payments & Accounting

| # | Status | Feature | Detail & Resolution |
|---|---|---|---|
| **P1** | ✅ **RESOLVED** | **Bachs live key configuration & guard** | **Implemented 2026-09-25.**<br>• Backend: Added production environment verification blocking startup or mock completion in live mode without valid `BACHS_API_KEY`.<br>• Verified: Security test suite verifies production failure without key (`verify-security.ts`). |
| **P2** | ✅ **RESOLVED** | **Bachs webhook registration & idempotency** | **Implemented 2026-09-25.**<br>• Webhook: Endpoint `/api/payments/webhook/bachs` verifies HMAC-SHA256 signature and event timestamp.<br>• Idempotency: Deduplication cache and transactional guards prevent double crediting or double processing on replayed events (`verify-payments-blockers.ts`). |
| **P3** | ✅ **RESOLVED** | **Refund management flow** | **Implemented 2026-09-25.**<br>• Backend: Added `POST /admin/payments/:id/refund` with `RefundPaymentDto` supporting partial and full refunds.<br>• Webhook: Handlers for `refund.paid` and `refund.processed` update payment status to `REFUNDED` / `PARTIALLY_REFUNDED`, release booking slots on full refund, cancel bookings, and dispatch cancellation emails.<br>• Frontend: Added `RefundPaymentDialog.tsx` modal on Admin Payments page with validation and refund reason input.<br>• Verified: Automated test suite in `backend/scripts/verify-payments-blockers.ts`. |
| **P4** | ✅ **RESOLVED** | **Admin studio payment flexibility (CASH, POS, TRANSFER)** | **Implemented 2026-09-25.**<br>• Backend: Expanded `POST /admin/bookings/:id/pay` to accept custom amounts (`amountKobo`), payment channels (`CASH`, `POS`, `TRANSFER`), references, and notes.<br>• Support: Allows recording walk-in balance payments and deposits across both `PENDING` and `CONFIRMED` bookings with outstanding balances.<br>• Frontend: Added `RecordPaymentDialog.tsx` modal in Admin Bookings table for quick payment collection. |
| **P5** | ✅ **RESOLVED** | **Deposit & partial payment support** | **Implemented 2026-09-25.**<br>• Capability: Walk-in customers and phone bookings can pay partial amounts (e.g. 50% deposit via POS); remaining balance is tracked in `outstandingKobo` and can be settled via CASH or TRANSFER.<br>• Overpayment Guard: Automatically validates that payment does not exceed remaining outstanding balance. |
| **P6** | ⚪ **DEPRECATED** | **FIRS-compliant tax invoices & PDF receipts** | **Deprecated / Out of scope per studio directive.**<br>• The studio operates on standard digital booking confirmations and itemized payment receipts (P7) sent via email (Resend/SMTP) and recorded in the desk.<br>• Formal corporate FIRS sequential tax invoicing, studio TIN declaration, and statutory VAT PDF generating engine is explicitly retired and excluded from system requirements. |
| **P7** | ✅ **RESOLVED** | **Automated payment receipt email** | **Implemented 2026-09-25.**<br>• Templates: `payment_received` and `booking_confirmed` HTML emails itemize package name, amount paid, payment reference, remaining balance, and date. |
| **P8** | 🟢 MEDIUM | `PAID_UNPLACED` resolution queue | Backend still writes `PAID_UNPLACED` on the booking notes (`payments.service.ts`) and the public confirmation page has a `paid_unplaced` state (`BookConfirmationPage.tsx`). The admin desk has no queue or alert card that lists these for reassignment. |

---

## 4. Notifications & Email

| # | Status | Feature | Detail & Resolution |
|---|---|---|---|
| **N1** | ✅ **RESOLVED** | **Email provider configuration (Resend & SMTP)** | **Implemented 2026-09-25.**<br>• Integrated official `resend` SDK in `notifications.service.ts`.<br>• Added `RESEND_API_KEY` and `RESEND_FROM` configuration in environment.<br>• Fallback logic: Resend → SMTP → dry-run console log.<br>• Admin status endpoint reports active provider (`resend` / `smtp` / `dry-run`) and configuration health. |
| **N2** | ✅ **RESOLVED** | **Rich HTML email templates for all booking events** | **Implemented 2026-09-25.**<br>• Templates: Created `email-templates.ts` generating responsive, branded dark/gold HTML emails for all 7 booking lifecycle events (`booking_created`, `booking_confirmed`, `payment_received`, `booking_reminder`, `booking_rescheduled`, `booking_cancelled`, `payment_failed`).<br>• Design: Custom status badges, itemized booking reference tables, formatted Lagos/WAT dates, prep tips, and plain text fallbacks. |
| **N3** | ✅ **RESOLVED** | **Customer email unsubscribe & studio footer** | **Implemented 2026-09-25.**<br>• Compliance: Every transactional email template now includes studio physical address (Port Harcourt, Nigeria), support contacts, and transactional/reminder unsubscribe mailto links conforming to CAN-SPAM and GDPR requirements. |
| **N4** | ✅ **RESOLVED** | **Manual email dispatch / client messaging from admin** | **Implemented 2026-09-25.**<br>• Backend: Added `POST /admin/notifications/send-manual` endpoint with `SendManualNotificationDto` and audit logging.<br>• Frontend: Added "Manual message" modal dialog on `/admin/notifications` allowing staff to compose and send custom branded studio messages to any recipient. |
| **N5** | ✅ **RESOLVED** | **SMS notification channel graceful safety** | **Implemented 2026-09-25.**<br>• Channel: Replaced unconditional `throw new Error` in `SmsNotificationChannel` (`email.channel.ts`) with graceful dry-run logging to prevent unhandled service crashes. |
| **N6** | ✅ **RESOLVED** | **Reminder scheduler window robustness** | **Implemented 2026-09-25.**<br>• Engine: Widened query window in `reminder.scheduler.ts` with 15-min lead buffer and persistent DB deduplication check (`hasReminderBeenSent`) so server restarts or deploy delays never drop scheduled 24h/2h reminders. |

---

## 5. Media & File Storage

| # | Status | Feature | Detail |
|---|---|---|---|
| **M1** | ✅ RESOLVED | Object storage integration (Cloudflare R2 / AWS S3) | Implemented `StorageService` with `LocalStorageProvider` and `R2StorageProvider`. Swappable via `STORAGE_PROVIDER=local` or `STORAGE_PROVIDER=r2`, supporting S3-compatible R2 endpoints, automatic WebP thumbnails, and CDN public URL resolution. |
| **M2** | ✅ RESOLVED | Image resizing & WebP optimization | Sharp pipeline automatically normalizes uploaded images to WebP (q85) and generates 800px thumbnails (q80). |
| **M3** | ✅ RESOLVED | Upload file size & count limits | Explicit Multer limits enforced: max 10 files per request, ≤ 15 MB per file, MIME validation. |
| **M4** | ✅ RESOLVED | CDN configuration | Direct support for custom CDN caching domain via `R2_PUBLIC_URL` (e.g. `https://cdn.photoarenang.com`). |

---

## 6. Admin CMS & Content

| # | Status | Feature | Detail |
|---|---|---|---|
| **C1** | ✅ **RESOLVED** | **Provisional package approval** | `POST /admin/services/:id/approve-pricing` and `POST /admin/services/approve-all-pricing` clear `isProvisional` on the service and its packages, and flip `site.pricesProvisional` when none remain (`catalog.service.ts`). Services desk has a “Confirm Final Pricing” button (`AdminServicesPage.tsx`). Script: `backend/scripts/verify-c1-c4.ts`. |
| **C2** | ✅ **RESOLVED** | **Blog markdown editor** | `@uiw/react-md-editor` with live split preview, formatting commands, and an Insert Image action (`AdminBlogEditorPage.tsx`). Public post renders with `react-markdown`. |
| **C3** | ✅ **RESOLVED** | **Blog cover / asset picker** | `BlogAssetPickerModal.tsx` inserts gallery media into the body and can set the cover and OG image. |
| **C4** | ✅ **RESOLVED** | **Per-post SEO metadata** | `BlogPost.metaTitle`, `metaDescription`, `ogImageUrl` on the schema. Editor has an SEO panel; `BlogPostPage.tsx` uses those fields for the document head. |
| **C5** | ✅ **RESOLVED** | **Enquiry email reply** | `POST /admin/enquiries/:id/reply` sends via `sendManualNotification`, stores the reply on `internalNote`, and sets status `REPLIED` (`enquiries.service.ts`). Script: `backend/scripts/verify-enquiry-reply.ts`. |
| **C6** | ✅ **RESOLVED** | **Opening hours sync** | Stale row. `BookingsService` loads `site.hours.weekday` and `site.hours.sunday`; `parseOpeningHours` in `availability.ts` applies them. Same path as B1. |
| **C7** | 🟢 MEDIUM | Newsletter broadcast capability | Subscribers can be listed, exported as CSV, and deleted (`newsletter.controller.ts`). There is no send-to-list action. |
| **C8** | 🟢 MEDIUM | Testimonial verification link | `Testimonial` has quote, name, rating, and publish flag only. No `bookingId`. |

---

## 7. Public Website & UX

| # | Status | Feature | Detail |
|---|---|---|---|
| **W1** | 🟡 HIGH | Live Google Reviews / social proof | No Places widget, rating badge, or review fetch anywhere in `frontend/src` or `backend/src`. Social proof is the CMS testimonial list. |
| **W2** | ✅ **RESOLVED** | **TikTok link** | Fallback `https://www.tiktok.com/@photoarenang` in `frontend/src/lib/site.ts`. `useSiteInfo()` reads `social.tiktok` and falls through to that default when the CMS value is blank. Footer renders the link. |
| **W3** | ✅ **RESOLVED** | **WhatsApp click-to-chat** | `WhatsAppFab` in `SiteChrome.tsx` is mounted from `SiteLayout`. It uses `site.whatsapp` (default `https://api.whatsapp.com/send/?phone=2349059813823`) and appends a pre-filled enquiry. Footer has the same icon. Hidden when the setting is empty. |
| **W4** | ✅ **RESOLVED** | **Portfolio vs Gallery** | Public nav label is “Portfolio” (`site.ts`). `App.tsx` redirects `/gallery` to `/portfolio`. Admin `/admin/gallery` remains the media library. |
| **W5** | 🟡 HIGH | Route transition loading indicators | No navigation progress bar. `NProgress` / `useNavigation` are not used. |
| **W6** | ✅ **RESOLVED** | **Cookie-gated analytics** | `AnalyticsLoader` loads GA4 only when `consent.analytics` is set and Meta Pixel only when `consent.marketing` is set (`frontend/src/lib/analytics.tsx`). Empty measurement IDs no-op. |
| **W7** | 🟢 MEDIUM | Home page component inspection | Home sections exist in `frontend/src/components/home/`. This pass did not open the page in a browser. |
| **W8** | 🟢 MEDIUM | FAQ accordion polish | `FaqList.tsx` is a single-open accordion with `aria-expanded` and a rotating plus icon. There is no FAQ search. |

---

## 8. Deployment & Infrastructure *(Omitted from Current Scope)*
> **Status:** Deferred / Excluded from current application sprint per project scope directive. All items below are retained for post-launch reference.

| # | Status | Feature | Detail |
|---|---|---|---|
| **D1** | ⚪ OMITTED | Production Docker Compose & Nginx | Provide multi-stage production Dockerfiles for NestJS & Vite + Nginx reverse proxy with SSL termination. |
| **D2** | ⚪ OMITTED | Production `JWT_SECRET` rotation | Replace all development `change-me` secrets with cryptographically secure random 256-bit strings. |
| **D3** | ⚪ OMITTED | Automated PostgreSQL backup | Daily pg_dump cron with retention policy and encrypted offsite storage (S3/R2). |
| **D4** | ⚪ OMITTED | Production CORS & Host validation | `PUBLIC_SITE_ORIGINS` must include final production domains (`https://photoarenastudios.com`). |
| **D5** | ⚪ OMITTED | Health check readiness probe | Add database ping check to `/api/health` so orchestrator knows when DB is ready. |
| **D6** | ⚪ OMITTED | CI/CD automated pipeline | GitHub Actions workflow running `tsc`, `verify:rules`, `verify:security`, and build checks. |
| **D7** | ⚪ OMITTED | Redis rate limiter & cache | Replace in-memory rate limit Map with Redis for distributed multi-worker support. |
| **D8** | ⚪ OMITTED | Nginx SPA routing & caching | Nginx `try_files $uri $uri/ /index.html;` with gzip and cache-control headers on static assets. |
| **D9** | ⚪ OMITTED | Hostinger VPS resource validation | Verify Node.js v20+, PostgreSQL 16, and RAM headroom (minimum 2GB recommended). |
| **D10** | ⚪ OMITTED | Structured logging & log shipping | Winston / Pino JSON logging shipped to Logtail or CloudWatch. |
| **D11** | ⚪ OMITTED | Error tracking (Sentry) | Sentry SDK for NestJS backend and React frontend error boundaries. |

---

## 9. Security & Hardening

| # | Status | Feature | Detail |
|---|---|---|---|
| **S1** | ✅ **RESOLVED** | **Overlap exclusion constraint edge cases** | **Verified 2026-09-25.**<br>• Row-level lock (`SELECT ... FOR UPDATE` on `StudioResource`) serializes concurrent booking requests.<br>• Stress tested via `backend/scripts/verify-overlap-stress.ts` across 5, 10, 20, 50 concurrent requests per slot (85 total requests, 81 conflicts rejected with 409, 0 database overlaps). |
| **S2** | 🟡 HIGH | Content Security Policy (CSP) | No Helmet and no `Content-Security-Policy` header in `backend/src`. `react-helmet-async` only sets document metadata. |
| **S3** | 🟡 HIGH | Strict HTTPS enforcement | No HSTS header in the API. HTTP→HTTPS redirect would live in Nginx, which is still omitted (D1, D8). |
| **S4** | ✅ **RESOLVED** | **Upload byte inspection** | `gallery.service.ts` does not trust the client MIME type. `sharp(buffer, { failOn: "error" }).metadata()` must report `jpeg`, `png`, or `webp` or the upload is rejected. The `file-type` package is not used. |
| **S5** | 🟢 MEDIUM | Audit log coverage | Desk mutations for catalog, blog, gallery, settings, FAQs, testimonials, enquiries, bookings, users, and notification sends call `AuditService`. `auth.controller.ts` (login, password change, account patch, reset) does not. |

---

## Verification Test Matrix

All current verification suites can be executed from the workspace root:

```bash
# Security & Auth RBAC verification (27 assertions)
npm run verify:security

# Dedicated Auth Features test suite (10 test cases: A1, A2, A3)
npx tsx backend/scripts/verify-auth-features.ts

# Dedicated Booking Engine test suite (B1, B2, B3, B4)
npx tsx backend/scripts/verify-booking-features.ts

# CMS pricing approval, blog SEO fields (C1–C4)
npx tsx backend/scripts/verify-c1-c4.ts

# Enquiry reply email (C5)
npx tsx backend/scripts/verify-enquiry-reply.ts

# Booking engine rules & holding state verification
npm run verify:rules

# Calendar integration & ICS generation verification
npm run verify:calendar

# Backend production build validation
cd backend && npm run build

# Frontend production build validation
cd frontend && npm run build
```

---

## Immediate Next Steps (Priority Sequence)

Still open after the 2026-09-25 code pass. Deployment items D1–D11 stay out of scope.

1. **S2:** Add a Content-Security-Policy that still allows GA4 and Meta Pixel only after consent.
2. **S3:** HSTS and HTTP→HTTPS once the host (Nginx) exists.
3. **A4:** Admin TOTP or email OTP. Desk login is still a single password.
4. **W1:** Google reviews widget or an explicit decision to keep CMS testimonials only.
5. **P8:** Admin card for bookings flagged `PAID_UNPLACED`.
6. **W5:** Route-change progress indicator. Polish, not a booking defect.

