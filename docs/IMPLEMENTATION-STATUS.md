# Implementation status

Last updated: 2026-09-25 (Post Production Gap Wave: A1, A2, A3 + Resend)

| Milestone | Status |
|---|---|
| 0 Repository / architecture audit | **VERIFIED** (static) + toolchain/skills |
| 1 Design system + visual redesign | **PARTIAL / IN PROGRESS** — charcoal/champagne tokens live; visual QA pending your inspection |
| 2 Public website completion | PARTIAL |
| 3 Services/packages/catalog | PARTIAL — public packages include server `onlinePriceKobo` |
| 4 Booking engine | **COMPLETE & HARDENED** — CMS-driven opening hours (CMS-2 / B1), Nigerian phone validation (B2), duplicate booking protection (B3), configurable hold duration (B4); `verify:rules` and `verify:booking-features` **PASS** |
| 5 Bachs + reconciliation | **COMPLETE & HARDENED** — Webhook HMAC verification, idempotency deduplication cache, offline cash/POS/transfer recording, partial deposits, and admin refund management with slot release; verified by `verify-payments-blockers.ts` |
| 6 Admin auth/RBAC | **COMPLETE & HARDENED** — covered by `verify:security` **PASS** and `verify:auth-features` **PASS** (10/10). Added password reset flow (A1), instant session revocation / logout-all (A2), and persistent dual-storage remember-me (A3) |
| 7 Admin CMS/CRM | PARTIAL — discount % editor + required nav aliases |
| 8 Media / object storage | **COMPLETE & TESTED** — `StorageService` with local and Cloudflare R2 provider (`@aws-sdk/client-s3`), automatic WebP normalization, and 800px thumbnails via `sharp`; verified by `verify:storage` |
| 9 Notifications | **COMPLETE & HARDENED** — Resend & SMTP providers, responsive dark/gold HTML email templates for all 7 booking events, CAN-SPAM/GDPR unsubscribe footer, and manual notification dispatcher; verified by `verify:notifications` |
| 10 Google Calendar + ICS | PARTIAL → ICS VALARM + Google Calendar URL added; `verify:calendar` **PASS** |

| 11 Policies / cookies | PARTIAL — cookie consent with granular categories; no phantom trackers |
| 12 Security hardening | **HARDENED** — CORS allowlist, Host check (prod), tokenVersion JWT invalidation, enumeration-safe auth, timing-safe webhook HMAC |
| 13 Database hardening | **COMPLETE** — Prisma schema with payment refund amounts, reasons, channels, password reset tokens, and tokenVersion |
| 14 Responsive / a11y | PARTIAL — lightbox trap + mobile prev/next |
| 15 Full integration QA | IN PROGRESS |
| 16 Production / deployment | PARTIAL (Infrastructure D1–D11 omitted per project scope) |

---

## Recent Sessions

### 2026-09-25: Admin Walk-in Booking, Sidebar Polish, S1 Exclusion Verification & P6 Deprecation

**What changed:**
1. **Admin Walk-in & Session Creation:**
   - Built [CreateBookingDialog.tsx](file:///home/bash/Desktop/photo-arena/photo-arena/frontend/src/components/admin/CreateBookingDialog.tsx) supporting package selection, real-time slot checking (with admin bypass for same-day notice), customer phone validation, and optional on-the-spot POS/Cash/Transfer payment recording.
   - Mounted directly onto Admin Dashboard (Hero `+ Book Session` button and Quick Actions `Book Walk-in` card) and Admin Bookings desk (`+ New Booking`).
   - Verified 100% via `backend/scripts/verify-admin-booking.ts` (6/6 steps).
2. **Collapsed Sidebar Redesign:**
   - Swapped out squashed text logo for the crisp golden camera aperture mark (`/apple-touch-icon.png`), centered within a 64px header zone that aligns with the topbar.
   - Upgraded collapsed nav items into 40x40 tactile rounded buttons with champagne gold active indicators, smooth hover transitions, and tooltips.
   - Normalized route active state detection across root `/admin`, trailing slashes, and nested subpaths.
3. **S1 Blocker — Overlap Exclusion Concurrent Stress Test:**
   - Executed `backend/scripts/verify-overlap-stress.ts` across 5, 10, 20, 50 concurrent requests per slot.
   - 85 total requests, 81 conflicts rejected with 409, 0 database overlaps. S1 marked **RESOLVED**.
4. **P6 Deprecation:**
   - Formally marked **P6 (FIRS-compliant tax invoices & PDF receipts)** as **DEPRECATED / OUT OF SCOPE** per studio directive. The studio operates on standard digital booking confirmations and itemized payment receipts (P7) via Resend/SMTP.

---

### 2026-09-25: Payment Blockers & Accounting Hardening (P1, P2, P3, P4, P5, P7)

**What changed:**
1. **Database & Schema Updates (`schema.prisma`):**
   - Expanded `PaymentStatus` enum with `REFUNDED` and `PARTIALLY_REFUNDED`.
   - Added `refundedAmountKobo`, `refundReason`, `channel`, and `refundedAt` fields to `Payment` model.
2. **Offline Studio Payment Flexibility (P2 / P4 / P5):**
   - Expanded `POST /admin/bookings/:id/pay` to accept custom amounts (`amountKobo`), channels (`CASH`, `POS`, `TRANSFER`), references, and notes.
   - Allowed recording balance payments across both `PENDING` and `CONFIRMED` bookings with outstanding balances.
   - Enforced balance overpayment prevention.
   - Created [RecordPaymentDialog.tsx](file:///home/bash/Desktop/photo-arena/photo-arena/frontend/src/components/admin/RecordPaymentDialog.tsx) for payment collection from the Admin Bookings table.
3. **Refund Management & Automation (P3):**
   - Added `POST /admin/payments/:id/refund` with `RefundPaymentDto` supporting partial and full refunds with reason validation.
   - Extended Bachs webhook handler to process `refund.paid` and `refund.processed` events.
   - Implemented automated booking slot release (`booking.status = CANCELLED`) upon 100% refund, freeing the slot for new customers.
   - Triggered customer cancellation emails via `booking_cancelled`.
   - Created [RefundPaymentDialog.tsx](file:///home/bash/Desktop/photo-arena/photo-arena/frontend/src/components/admin/RefundPaymentDialog.tsx) for issuing refunds from Admin Payments table.
4. **Webhook Security & Idempotency (P1 / P2):**
   - Enforced HMAC-SHA256 signature verification and payload validation.
   - Added deduplication cache preventing duplicate processing on retried/replayed webhooks.

**Tests run & verified:**
- `backend/scripts/verify-payments-blockers.ts` — **100% PASS** (11/11 steps: partial POS deposit, overpayment rejection 400, cash balance payment, partial refund, full refund, double refund rejection 400, signed refund webhook processing, booking slot release, and replay idempotency).
- `npm run verify:security` — **100% PASS** (27/27 assertions).
- `npm run verify:rules` — **100% PASS**.
- `npm run verify:calendar` — **100% PASS**.
- `npm run verify:storage` — **100% PASS**.
- `npm run verify:notifications` — **100% PASS**.
- `backend/scripts/verify-admin-email-edit.ts` — **100% PASS**.
- `backend/scripts/verify-booking-features.ts` — **100% PASS**.
- Backend build (`nest build`) & Frontend build (`tsc -b && vite build`) — **0 errors**.

---

### 2026-09-25: Admin Email Editing & Self-Service Profile Update

**What changed:**
1. **Self-Service Account Update (`PATCH /auth/account`):**
   - Unlocked `PATCH /auth/account` for all authenticated desk roles (`ADMIN`, `STAFF`, `OWNER`) instead of restricting to owner only.
   - Preserved required `currentPassword` verification and duplicate email collision checks.
   - Returns both updated `user` object and fresh signed JWT `token`.
2. **Admin User Management (`PATCH /admin/users/:id`):**
   - Allowed `ADMIN` role to call `PATCH /admin/users/:id` to edit their own user profile or staff records.
   - Enforced backend RBAC safeguards preventing non-owners from modifying owner accounts, elevating roles to `OWNER`, or altering permissions/active status.
3. **Frontend Dialog & Dropdown Menu:**
   - Built [EditProfileDialog.tsx](file:///home/bash/Desktop/photo-arena/photo-arena/frontend/src/components/admin/EditProfileDialog.tsx) for editing full name and email address with password confirmation.
   - Added "Edit profile" action to the header dropdown menu in [AdminLayout.tsx](file:///home/bash/Desktop/photo-arena/photo-arena/frontend/src/components/admin/AdminLayout.tsx), making it accessible from any desk page.
   - Added self-editing support in [AdminUsersPage.tsx](file:///home/bash/Desktop/photo-arena/photo-arena/frontend/src/pages/admin/AdminUsersPage.tsx) with non-owner protection on role/access toggles.
   - Integrated `applyAccount` in `auth.tsx` to automatically update React state, `localStorage`, and `sessionStorage` without requiring re-login.

**Tests run & verified:**
- `backend/scripts/verify-admin-email-edit.ts` — **10/10 PASS** (wrong password rejection 403, duplicate email collision 400, email change via `/auth/account`, database verification, `/auth/me` sync, email update via `/admin/users/:id`, and non-owner privilege escalation block 403).
- `npm run verify:security` — **100% PASS** (27/27 assertions).
- `npm run verify:rules` — **100% PASS**.
- `npm run verify:calendar` — **100% PASS**.
- `npm run verify:storage` — **100% PASS**.
- `npm run verify:notifications` — **100% PASS**.
- `backend/scripts/verify-booking-features.ts` — **100% PASS**.
- Backend build (`nest build`) & Frontend build (`tsc -b && vite build`) — **0 errors**.

---

### 2026-09-25: Production Gap Items B1, B2, B3, B4 (Booking Engine Hardening)

**What changed:**
1. **B1: CMS-Driven Opening Hours (CMS-2 Resolved):**
   - Implemented `parseOpeningHours` in `availability.ts` handling 12h/24h time formats, custom daily spans, and "Closed" statuses.
   - Connected `BookingsService` (`availability()`, `hold()`, `createAdmin()`, `reschedule()`) to `site.hours.weekday` and `site.hours.sunday` in `BusinessSettings`.
   - Guaranteed that closed days return 0 available slots and block booking holds with 409 Conflict.
2. **B2: Strict Phone Number Validation:**
   - Added `validateBookingPhone` on `BookPage.tsx` with live real-time feedback, Nigerian prefixes (`070/080/081/090/091...`), international codes (`+234...`), and accessible error labels.
   - Implemented `IsValidPhoneConstraint` on `HoldBookingDto` and `CreateAdminBookingDto` to strictly reject malformed phone strings or letters.
3. **B3: Customer Duplicate Booking Protection:**
   - Added transactional guard in `hold()` preventing a customer from creating duplicate active holds or bookings for the same start time.
4. **B4: Configurable Hold Duration:**
   - Dynamic hold duration reading from `site.booking.holdMinutes` with fallback to 15 minutes.

**Tests run & verified:**
- `backend/scripts/verify-booking-features.ts` — **PASS** (bad phone rejection, valid Nigerian phone hold, duplicate booking 409, CMS Sunday close 0 slots & 409 guard, custom hours availability span).
- `backend/scripts/verify-auth-features.ts` — **10/10 PASS**.
- `npm run verify:security` — **100% PASS** (27/27 assertions).
- `npm run verify:rules` — **100% PASS**.
- `npm run verify:calendar` — **100% PASS**.
- Backend (`nest build`) & Frontend (`tsc -b && vite build`) — **0 errors**.

---

### 2026-09-25: Production Gap Items A1, A2, A3 + Resend Integration

**What changed:**
1. **Resend Emailing Integration:**
   - Integrated official `resend` SDK into `backend/src/notifications/notifications.service.ts`.
   - Added `RESEND_API_KEY` and `RESEND_FROM` configuration in environment files (`.env`, `backend/.env`, `backend/.env.example`).
   - Built transactional password reset email with luxury gold/dark responsive HTML template and plaintext fallback.
   - Updated `admin-notifications.controller.ts` to expose active provider (`resend` vs `smtp` vs `dry-run`).
2. **A1: Password Reset Flow:**
   - Added `PasswordResetToken` Prisma model (`tokenHash`, `expiresAt`, `usedAt`, 60-min TTL).
   - Created public endpoints: `POST /auth/forgot-password` (enumeration-safe), `GET /auth/verify-reset-token`, `POST /auth/reset-password`.
   - Created admin frontend pages: `/admin/forgot-password` and `/admin/reset-password?token=...`.
3. **A2: Token Revocation / Logout All:**
   - Implemented `tokenVersion` bumping on `User` to instantly invalidate all issued JWTs.
   - Created caller endpoint `POST /auth/revoke-sessions` and OWNER endpoint `POST /admin/users/:id/revoke-sessions`.
   - Wired UI into `AdminLayout.tsx` user profile dropdown ("Sign out all devices") and `AdminUsersPage.tsx` user management table.
4. **A3: Remember Me / Persistent Storage:**
   - Extended `frontend/src/lib/auth.tsx` with dual-engine storage (`localStorage` when Remember Me is checked, `sessionStorage` otherwise).
   - Added "Remember me" checkbox on `/admin/login` page.
   - Guaranteed full sweep of both storage engines on logout or revocation.


**Tests run & verified:**
- `backend/scripts/verify-auth-features.ts` — **10/10 PASS** (forgot-pwd timing/enumeration safety, token expiry, token single-use, password reset, tokenVersion session invalidation, logout-all endpoint, admin revoke endpoint, bad tokens rejection).
- `npm run verify:security` — **100% PASS** (27/27 security assertions pass).
- `npm run verify:rules` — **100% PASS** (booking invariants & hold states pass).
- `npm run verify:calendar` — **100% PASS** (Google Calendar URLs & ICS formatting pass).
- Backend TypeScript compilation (`nest build`) — **0 errors**.
- Frontend TypeScript compilation & bundle (`tsc -b && vite build`) — **0 errors**.

**Next Priorities:**
- **P1 / P2:** Bachs live key configuration and webhook secret registration.
- **M1 / M2:** Cloudflare R2 / AWS S3 object storage integration and Sharp image resizing pipeline.
- **B5 / B6:** Customer self-service booking lookup page (`/book/lookup`) and cancellation request flow.

---

### 2026-09-25: Production Gap Items N1–N6 (Notifications & Email Suite)

**What changed:**
1. **N2: Branded HTML Email Templates for all 7 Booking Events:**
   - Created `backend/src/notifications/email-templates.ts` generating luxury dark/gold responsive HTML templates for:
     - `booking_created` (temporary hold placed, expiration warnings)
     - `booking_confirmed` (session confirmed, prep tips)
     - `payment_received` (itemized payment receipt)
     - `booking_reminder` (upcoming shoot reminder, studio preparation checklist)
     - `booking_rescheduled` (updated session time, reschedule notes)
     - `booking_cancelled` (cancellation notification)
     - `payment_failed` (payment issue notice, retry instructions)
   - Integrated into `NotificationsService.notifyEvent()` with plain-text fallback and Lagos/WAT formatted dates.
2. **N3: Customer Email Unsubscribe & Studio Footer:**
   - Every transactional notification template now includes Photo Arena's physical address (Port Harcourt, Nigeria), official support contacts, and direct reminder opt-out / unsubscribe mailto links conforming to CAN-SPAM and GDPR requirements.
3. **N4: Manual Email Dispatch / Client Messaging:**
   - Backend: Added `POST /admin/notifications/send-manual` endpoint with `SendManualNotificationDto` and audit logging.
   - Frontend: Added "Manual message" modal dialog on `/admin/notifications` allowing staff to compose and send custom branded studio messages to any recipient.
4. **N5: Graceful SMS Channel Safety:**
   - Replaced unconditional crash in `SmsNotificationChannel` (`email.channel.ts`) with graceful dry-run logging.
5. **N6: Robust Reminder Scheduler Window:**
   - Widened query window in `reminder.scheduler.ts` with 15-min lead buffer and persistent DB deduplication check (`hasReminderBeenSent`) so server restarts or deploy delays never drop scheduled 24h/2h reminders.

**Tests run & verified:**
- `backend/scripts/verify-notifications.ts` — **PASS** (HTML template generation, unsubscribe links, manual email composer, SMS graceful handling, DB logging).


