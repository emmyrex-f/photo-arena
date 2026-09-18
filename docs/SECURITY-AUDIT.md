# Photo Arena — Backend Security Audit

**Date:** 2026-09-14  
**Scope:** Existing NestJS backend (`backend/src`, `backend/prisma`). No frontend, no VPS/Nginx.  
**Method:** Static review of auth, payments, bookings, uploads, env handling, logging, and schema.  
**Constraint:** Findings only. Do not treat this document as a rewrite plan. Working pricing, availability, and status logic should be hardened in place.

No secrets, keys, or credential values are recorded here.

---

## Existing controls (keep)

These are already in the right place. Hardening should extend them, not replace them.

| Area | What works |
|---|---|
| Validation | Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` |
| Admin authz | `JwtAuthGuard` + `RolesGuard` on `/api/admin/*`; OWNER-only user CRUD; STAFF is read-only where `@Roles` is set |
| Passwords | `bcryptjs` (cost 10); `passwordHash` excluded from user list selects; generic login error |
| Public CMS | `GET /api/public/settings` filters to public key prefixes |
| Pricing | Payable amount computed in `PricingService` from DB package price + `PricingRule` bps; frozen on `Booking.amountKobo` at hold |
| Webhook crypto | HMAC-SHA256, `timingSafeEqual`, 5-minute timestamp skew, prefer `X-Bachs-Signature-V2` |
| Webhook body | `rawBody: true`; signature over raw bytes (fail closed if raw body missing) |
| Payment idempotency | `Payment.updateMany({ status: { not: SUCCESS } })` plus `ProcessedWebhookEvent` unique `id` |
| Mock safety | `POST /api/payments/mock/complete` rejected when a Bachs API key is configured |
| Uploads (partial) | Auth required to upload; 15 MB / 10-file limits; MIME prefix `image/` |
| Secrets in git | `.env` is gitignored; seed log prints owner **email**, not password |
| Health | `/api/health` returns `{ ok, service }` only |

---

## Critical

### C1 — Unauthenticated mock payment completion when Bachs is not configured

`POST /api/payments/mock/complete` is public. It confirms a payment (`Payment → SUCCESS`, `Booking → CONFIRMED`) if `BACHS_API_KEY` is empty (or `NODE_ENV=test`).

That is the default local factory in `PaymentsModule`: no key → `MockPaymentProvider`. Anyone who can reach the API and knows (or guesses) a payment `reference` can mark a hold paid without Bachs.

**Impact:** Free confirmed bookings; slot theft; fake revenue.

**Fix (keep mock for local/dev only):**

- Gate mock complete on an explicit non-production flag (e.g. `PAYMENTS_MOCK=true` **and** `NODE_ENV !== "production"`), not on “key missing”.
- Refuse to boot in production if the Bachs key is missing.
- Optionally require a local-only header/token for mock complete.

### C2 — Guest checkout has no hold-ownership check

`POST /api/bookings/:id/checkout` is unauthenticated. Knowledge of the booking id is enough to start (or replace) a Bachs/mock session.

An attacker who sees the id during the 15-minute hold can:

- Call checkout with **their** `returnUrl` / `cancelUrl` (open redirect / phishing after pay).
- Overwrite `providerSessionId` on the existing PENDING/PROCESSING payment.

Combined with C1 (mock enabled), they can also complete the payment.

**Fix:** Bind checkout to the hold (e.g. require `reference` in the body and match `booking.reference`; reject if hold expired). Allowlist `returnUrl` / `cancelUrl` to the public site origin. Do not take checkout URLs from arbitrary domains.

---

## High

### H1 — No login brute-force protection

`POST /api/auth/login` has no rate limit, lockout, backoff, or CAPTCHA. Nest has no `@nestjs/throttler` (or equivalent) in the backend.

The seed OWNER password falls back to a well-known short default if `SEED_OWNER_PASSWORD` is unset. Seed **re-hashes and updates** that user on every seed run.

**Fix:** Per-IP and per-email throttle on login (and `change-password`). Lock or delay after N failures. Require a strong `SEED_OWNER_PASSWORD` in any shared/staging environment; never seed defaults into production.

### H2 — JWT is not bound to current user state

`JwtAuthGuard` trusts `sub`, `email`, `name`, and **`role` from the token**. It does not load the user from the database.

Consequences until the 8-hour expiry:

- Deactivated users (`isActive: false`) still call admin APIs.
- Role demotion/promotion is delayed (privilege persistence).
- Password change / reset does not revoke existing sessions (no token version / denylist).

`GET /api/auth/me` does check `isActive`; other routes do not.

**Fix:** On each request, load `User` by `sub` and require `isActive`. Authorize with **DB role**, not JWT role. Increment a `tokenVersion` (or `passwordChangedAt`) on password change, reset, deactivate, and role change; reject stale tokens. Keep 8h expiry if you want; do not add a second session store unless needed.

### H3 — CORS reflects any origin

`app.enableCors({ origin: true })` echoes the request `Origin`.

Browser clients on any site can call public booking/payment/auth endpoints. That amplifies H1, H4, and C2. Admin APIs still need a stolen Bearer token (JWT is not a cookie), so this is not a classic CSRF cookie issue — it is an allow-all API.

**Fix:** Allowlist the public site and admin origin(s) from env (e.g. `CORS_ORIGINS`). Do not use `origin: true` in production.

### H4 — Unauthenticated hold can lock the calendar (DoS)

`POST /api/bookings/hold` is public (correct for guest booking) but unbounded. Each call creates a 15-minute `TEMPORARY_HOLD` that **blocks availability**.

No rate limit, CAPTCHA, or per-phone/IP cap.

**Fix:** Throttle by IP and phone. Cap concurrent holds per phone/email. Keep the 15-minute hold and overlap rules as they are.

### H5 — Booking overlap is application-only (race)

Hold, admin create, and reschedule use `prisma.$transaction`: `findMany` blocking bookings → `slotFits` → `create`/`update`. There is no `SELECT FOR UPDATE`, serializable isolation, or PostgreSQL exclusion constraint.

Two concurrent holds for the same slot can both pass the read and both insert. `ARCHITECTURE.md` already notes an exclusion constraint as future work.

**Fix:** Keep `slotFits` as the rule engine. Add a DB constraint, e.g. `tstzrange(startTime, endTime) WITH &&` **excluding** `CANCELLED` / expired holds (or a partial unique/exclude on `resourceId`). Use `UPDATE "StudioResource" SET id = id WHERE id = $1` (or equivalent) as a transaction lock if you need an interim lock without changing slot math.

### H6 — Successful payment confirms the booking regardless of hold state

`confirmPayment` sets `Booking.status = CONFIRMED` with no check that the booking is still `TEMPORARY_HOLD`, that the hold has not expired, or that the slot is still free.

If the hold expired (`CANCELLED`) and the slot was taken by another booking, a late webhook/`verify` can still confirm the old row → two `CONFIRMED` sessions on the same resource.

`verify` / webhook also do **not** compare provider amount or currency to `Payment.amountKobo` / `NGN` (`PaymentVerification` has no amount fields). That violates the payment-security rule even though signature checks are present.

**Fix (minimal, same flow):**

- Before confirm: load payment + booking in the same transaction; require payment not already SUCCESS; require amount/currency match (add amount/currency to provider verify + webhook parse).
- If booking is `TEMPORARY_HOLD` (even if `holdExpiresAt` just passed) and the slot is still free → confirm (customer paid).
- If the slot is now occupied by another blocking booking → do **not** confirm occupancy; mark payment SUCCESS for finance and flag for admin (do not silently double-book).
- Do not confirm from `returnUrl` query params (already true).

### H7 — Upload `kind` is not an allowlist (path traversal)

`GalleryService.upload` uses `fields.kind` as a directory name:

`join(uploadsRoot(), kind.toLowerCase())` then `writeFile`, **before** Prisma enum validation.

An OWNER/ADMIN can send `kind=../…` and write outside the uploads root. Delete uses `join(uploadsRoot(), url.replace(/^\/uploads\//, ""))` with no `..` guard.

**Fix:** Allowlist `gallery | blog | content` only. Resolve the destination with `path.resolve` and require it stays under `uploadsRoot()`. Unlink only after the same check. Do not change the gallery data model.

### H8 — Uploaded file extension follows the client (stored XSS)

MIME is trusted from the client (`image/*`). The original extension is kept (`uuid.html` is possible if `mimetype` is spoofed as `image/jpeg`). Original bytes are written to disk; `sharp` runs after.

`/uploads` is static, no `Content-Disposition: attachment`, no `X-Content-Type-Options`. If the API origin is shared with the admin SPA, a stored HTML/SVG file can run script as that origin and steal a JWT from `localStorage`.

**Fix:** Allowlist JPEG/PNG/WebP (and optionally GIF). Detect type with `sharp` (or magic bytes), not the client MIME. Write only `uuid.webp` / `uuid.jpg`. Serve uploads with `nosniff` and a locked `Content-Type`. Prefer a separate downloads host.

---

## Medium

### M1 — Public booking status leaks customer PII by id

`GET /api/bookings/:id/status` and `GET /api/payments/verify?reference=` are public. Status includes customer `name` and `email`.

Ids are CUIDs (not sequential); references are `PA-` + 10 hex chars. Enumeration is hard but not access-controlled. Logs, referrers, or a leaked confirmation URL expose PII.

**Fix:** Return status + times + amount + payment status. Omit email (or require matching `reference` **and** a short confirmation token issued at hold).

### M2 — Checkout `returnUrl` / `cancelUrl` are attacker-controlled

`CheckoutDto` uses `@IsUrl({ require_tld: false })` with no origin allowlist. Bachs/mock will redirect the payer there after payment.

**Fix:** Same allowlist as C2 (public site origin only).

### M3 — Studio payment amount can be supplied by the admin client

`recordStudioPayment` uses `opts.amountKobo ?? booking.amountKobo ?? PricingService…`. OWNER/ADMIN can POST any non-negative kobo.

Privileged, but it is still trusting a frontend amount, which security rules forbid.

**Fix:** Always charge/record `booking.amountKobo` (already frozen). If you need a desk override, require a separate explicit field + audit, not a silent body amount.

### M4 — Checkout amount fallback skips the frozen online price

`amountKobo = booking.amountKobo ?? booking.package.priceKobo` — if `amountKobo` is null, checkout uses **list** price (no 5% online discount), not a hard fail.

**Fix:** If `booking.amountKobo` is missing on an ONLINE hold, recalc via `PricingService` or reject. Never take an amount from the client (already true).

### M5 — Webhook idempotency window and empty event ids

Processed-event insert happens **after** confirm. Concurrent duplicate deliveries are mostly saved by `updateMany` / `P2002`, but:

- `eventId: body.id ?? ""` — missing id skips durable dedupe (`if (event.eventId)` is false for `""`).
- Failed-payment path can notify more than once.

**Fix:** Require a non-empty event id (or synthesize from signature + timestamp + reference). Insert `ProcessedWebhookEvent` first (unique constraint) then apply side effects; on conflict return `{ duplicate: true }`.

### M6 — `checkout.completed` treated as success

`parse-bachs-webhook.ts` maps `checkout.completed` alongside `collection.succeeded`. If Bachs fires `checkout.completed` before funds clear, the booking confirms early.

**Fix:** Confirm only on `collection.succeeded` (and server-side verify of paid status). Keep other types as acknowledge-only.

### M7 — Customer identity is upserted by phone

Online hold `upsert`s `Customer` on `phone` and overwrites `name` / `email`. Anyone who submits an existing phone during hold can replace that customer’s contact fields.

**Fix:** Update name/email only when creating; on conflict, keep stored PII and attach the booking to the existing customer (or require a match on email).

### M8 — No HTTP security headers / body limits at the app layer

No `helmet`. No explicit JSON body size cap (Express default applies). Upload interceptor holds up to 10 × 15 MB in memory.

Production Nginx can add headers; the Node process still serves `/uploads` and `/api` without `X-Content-Type-Options`, `X-Frame-Options`, or HSTS.

**Fix:** `helmet` on the Nest app; tighter JSON limit; keep Nginx TLS/HSTS as the outer layer.

### M9 — STAFF can read all settings and CRM exports

`RolesGuard` allows any authenticated role when `@Roles` is omitted. STAFF can `GET` all `BusinessSettings` (including `notifications.recipients`), payments CSV, customers CSV, newsletter CSV, and notification logs (email addresses in payload).

That matches a “STAFF is read-only CRM” model, but settings is a broad dump.

**Fix:** Keep STAFF booking/customer read. Restrict `GET /admin/settings` and notification recipient lists to OWNER/ADMIN. Do not store secrets in `BusinessSettings`.

### M10 — Settings PUT disables the global ValidationPipe

`PUT /api/admin/settings` uses `whitelist: false, forbidNonWhitelisted: false` and upserts every string key. OWNER/ADMIN can create arbitrary keys (including `site.*` that then become public).

**Fix:** Allowlist known keys (or public-prefix + admin-prefix maps). Reject unknown keys. Do not store API keys in this table.

### M11 — Weak/placeholder JWT secret in local env

`JwtModule` uses `JWT_SECRET` via `getOrThrow` (app will not start if missing). A short or well-known local placeholder is enough to forge admin tokens if it is copied into a reachable environment.

**Fix:** Require a minimum length (e.g. 32+ random bytes) at boot. Rotate if it was ever used outside a private machine. Do not commit `.env`.

### M12 — Enquiry / newsletter / availability are unthrottled

Honeypot `botcheck` on enquiries only. Newsletter upsert and availability GET can be spammed (DB growth, mail if SMTP is on).

**Fix:** Same IP throttle as login/hold. Keep the honeypot.

### M13 — Hold does not require 30-minute grid alignment

`slotFits` checks hours, notice, duration-to-close, and overlap. It does not require `startTime` to be one of `generateCandidateStartsForYmd`. Clients can hold off-grid starts.

**Fix:** Reject starts not in the generated candidate list (same helper, no new slot math).

---

## Low

### L1 — Login timing differs when the user does not exist

`compare()` is skipped if there is no row. Message is already generic.

**Fix:** Dummy-compare a static hash when there is no user.

### L2 — Public blog payload includes extra fields

Published posts return `authorId`, `isPublished`, `createdAt`, `updatedAt`. Harmless but unnecessary.

**Fix:** Select the public contract fields only.

### L3 — `GET /api/bookings/availability` duration is unbounded

`Number(durationMinutes)` with no min/max. Invalid values can 500; huge durations just yield empty slots.

**Fix:** Clamp to package durations or 30–240 minutes.

### L4 — Admin query enums are cast without validation

`listRange` / payments list cast `status` / `method` strings to Prisma enums. Junk values surface as 500s.

**Fix:** `@IsEnum` on query DTOs; 400 on invalid.

### L5 — Email dry-run logs recipient addresses

`console.info("[email:dry-run]", event, to.join(","))` and queued mail logs. Not credentials, but PII in process logs.

**Fix:** Log event + count, not addresses. Never log passwords, JWT, Bachs keys, or SMTP passwords (currently not logged).

### L6 — Nest default error responses in development

Unhandled `Error` from Bachs `fetch` (response body in the message) can appear in the 500 payload when not running production `NODE_ENV`.

**Fix:** Map provider failures to `BadGatewayException` with a generic client message; log status code only.

### L7 — Schema gaps (integrity, not immediate exploit)

- No `EXCLUDE` on booking ranges (see H5).
- `Booking.amountKobo` nullable.
- No `CHECK (endTime > startTime)`.
- No `CHECK (amountKobo >= 0)` on Payment/Booking.
- `AuditLog.userId` has no FK.
- `NotificationLog.payload` stores full message JSON (PII at rest).
- Partial indexes for “blocking” bookings would make H5 cheaper.

**Fix:** Add CHECKs and the exclusion constraint. Keep enums as they are (`NO_SHOW` ≠ `CANCELLED`).

### L8 — `/api/health` discloses service name

Fine for ops; optional to reduce fingerprinting.

### L9 — bcrypt cost 10 / JWT 8h / no refresh tokens

Acceptable for an admin staff of a few users. Prefer cost 12 when you next touch password hashing. Refresh tokens are not required if H2 is fixed.

### L10 — Seed always resets OWNER hash

Re-running seed overwrites the OWNER password to the env/default. Operational footgun.

**Fix:** Update password only on create, or behind an explicit flag.

---

## Recommended fixes (priority)

Do these **in order**. Do not rewrite `PricingService`, `slotFits`, or the booking status machine.

1. **C1** — Disable mock complete unless explicitly non-production; fail boot in production without Bachs.
2. **C2 + M2** — Checkout requires matching `reference`; allowlist return/cancel URLs.
3. **H6** — Confirm payment only after amount/currency/reference/booking checks; do not double-book on late webhooks.
4. **H5** — PostgreSQL exclusion (or row lock) around the existing overlap check.
5. **H1 + H4 + M12** — Throttle login, hold, enquiry, newsletter.
6. **H2 + M11** — DB-backed JWT principal + strong secret + token version on password/role/deactivate.
7. **H3** — CORS allowlist.
8. **H7 + H8** — Upload path allowlist + extension/type allowlist + `nosniff`.
9. **M1** — Strip email from public status (or bind with reference).
10. **M3 + M4** — Never use a client amount; never fall back to undiscounted list price on ONLINE holds.
11. **M5 + M6** — Dedup before side effects; succeed only on `collection.succeeded` + verify.
12. **M8** — `helmet` + upload/JSON limits.
13. **M9 + M10** — Tighten settings/export roles and settings key allowlist.
14. **L3–L7** — Clamps, query enums, CHECKs, quieter logs.

---

## Out of scope (intentionally not changed)

- Frontend JWT storage (likely `localStorage`) — XSS impact is noted under H8.
- Nginx TLS, HSTS, and reverse-proxy IP forwarding — required at deploy, not in this Nest process.
- Replacing Bachs with another provider.
- Customer self-cancel/refund (forbidden by domain rules).
- Redesigning 30-minute slots, 5% discount, 15% reschedule fee, or 15-minute holds.

---

## Verification (2026-09-14)

Second pass: each finding re-checked against code. No exploits were executed (that would change booking/payment data). No secrets recorded.

Priority used: public internet exposure → auth required? → sensitive data → exploitability → impact.

### Confirmed (real issue)

| ID | Verdict | Public? | Auth? | Sensitive data? | Exploitability | Impact | Notes |
|---|---|---|---|---|---|---|---|
| **C1** | Confirmed | Yes | No | Bookings, payments | Easy | Critical if mock mode | Hold → checkout → `POST /payments/mock/complete`. Confirmation page also calls mock complete when `mock=1`. Vite `allowedHosts` includes `*.trycloudflare.com`, so this API is expected to be tunneled. **Not exploitable once a Bachs key is set.** |
| **H4** | Confirmed | Yes | No | Calendar occupancy | Easy | High (availability DoS) | Unbounded public `POST /bookings/hold` creates 15-minute blockers. |
| **H1** | Confirmed | Yes | No | Admin account | Easy if password is weak | High (admin takeover) | No throttle/lockout. Seed fallback password is a known short default. |
| **H5** | Confirmed | Yes | No | Slot integrity | Medium (needs concurrency) | High (double-book) | Read-then-insert in default isolation; no exclusion constraint. |
| **M7** | Confirmed | Yes | No | Customer name/email | Easy | Medium (PII overwrite, notification hijack) | `Customer` upsert on phone overwrites name/email. |
| **M12** | Confirmed | Yes | No | Enquiry/newsletter DB | Easy | Low–medium (spam) | Honeypot only on enquiries. |
| **C2 / M2** | Confirmed, **overrated as Critical** | Yes, but needs booking id | No | Payment redirect | Medium | Medium–high (phishing after pay) | Guest checkout is intentional. CUID is not enumerable. Real bug is unconstrained `returnUrl` and session overwrite **if** id/reference leak (they are placed in the confirmation query string). Not a free-booking path by itself when Bachs is on. |
| **H6** (late confirm) | Confirmed logic bug | Webhook/verify are public | No (needs a real paid session or C1) | Slot integrity | Low–medium | High **if** slot was reused | `confirmPayment` always sets `CONFIRMED`. |
| **H2** | Confirmed | Admin API | Yes (stolen or pre-deactivation JWT) | Admin data | Medium | High for 8h after deactivate | Guard never loads `User`. |
| **L10** | Confirmed footgun | If seed is run | N/A | Admin password | Operational | High if seed hits a live DB | Seed always updates OWNER hash. |
| **H7** | Confirmed, **lower severity** | No | OWNER/ADMIN | Filesystem | Medium for an admin | Medium (write outside uploads) | File is written before Prisma enum check. |
| **H8** | Confirmed, **narrower than written** | Uploads are public to read | OWNER/ADMIN to write | JWT if same-origin XSS | Medium | High **only if** `/uploads` shares the SPA origin | SVG (`image/svg+xml`) is the realistic XSS vector. HTML leftover after `sharp` failure is unlisted UUID — hard to find. Vite **does** proxy `/uploads` onto `:5173` (same origin as admin). Production Nginx layout is unverified. |

### Confirmed control gap, not currently attacker-exploitable

Treat as hardening, not as an open remote exploit.

| ID | Why it is not an exploit today |
|---|---|
| **H6 amount/currency** | Webhook is HMAC-gated. `verify` asks Bachs about **our** `providerSessionId`. Checkout amount is server-frozen. An attacker cannot change the charged amount without the webhook secret or a Bachs compromise. Still a policy miss vs payment-security rules. |
| **M3** | Only OWNER/ADMIN. Those roles can already edit catalogue prices and confirm studio payments. Client `amountKobo` is a policy smell, not a public tamper path. |
| **M4** | Hold always sets `amountKobo`. Fallback to list price is a rare/legacy path, not client tampering. |
| **M5** | Duplicate SUCCESS is already stopped by `updateMany`. Empty `eventId` only matters if Bachs omits `id`. |
| **M8 / L7** | Missing headers/CHECKs. No demonstrated bypass. |
| **M10** | OWNER/ADMIN CMS footgun (`site.*` keys become public). Not an unauthenticated issue. |
| **L1** | Timing oracle on admin emails. Tiny user set; generic error already used. |
| **L5 / L6** | PII or Bachs body in logs/dev errors. Not a remote read. |

### False positives (drop or reclassify as non-security)

| ID | Why |
|---|---|
| **M9** | STAFF read-only CRM is the documented role. Recipients/CSV access is intended unless you decide STAFF must not see PII. Not a bug. |
| **M13** | Off-grid start times are a **domain validation** gap. Overlap still applies. No privilege or payment bypass. |
| **L2** | Extra blog fields (`authorId`, timestamps) are not sensitive. |
| **L3** | Bad `durationMinutes` yields empty slots or a 500. No data leak. |
| **L4** | Invalid admin query enums → 500. Availability issue, not authorization. |
| **L8** | Health payload is fine. |
| **L9** | bcrypt cost 10 / 8h JWT are acceptable for a small admin staff. |

### Requires manual verification (do not treat as proven prod vulns)

| ID | What to check (no secrets in output) |
|---|---|
| **C1 in production** | Is `BACHS_API_KEY` set? If yes, mock complete is already `403`. If the server is tunneled (Cloudflare) **without** a key, C1 is live. |
| **H3** | Production origin layout. If Nginx serves site + `/api` same-origin, CORS is unused by the real app. If the API is a separate public host, allow-all CORS is real. |
| **H8 production XSS** | Does prod Nginx proxy `/uploads` on the **same origin** as `/admin`? If uploads are a different host, admin JWT is not stolen. |
| **M6** | Confirm with Bachs whether `checkout.completed` can fire before funds clear. |
| **M5 event id** | Confirm Bachs webhook envelope always has `id`. |
| **M11** | Confirm production `JWT_SECRET` is long and unique. Do not print it. Local placeholder strength is a local-only issue. |
| **H6 race in the wild** | Needs a paid webhook arriving after hold expiry **and** a second booking on the same slot. Code allows it; frequency unknown. |
| **L6** | Confirm production `NODE_ENV=production` so Nest does not send raw `Error.message` to clients. |

### Revised fix order (only confirmed, attacker-relevant items)

1. **C1** — Mock complete must not be reachable on any internet-facing process.
2. **H4 + H1 + M12** — Rate-limit hold and login (and enquiry/newsletter).
3. **H5** — DB overlap constraint or row lock (keep `slotFits`).
4. **C2 / M2** — Allowlist checkout URLs; optional reference bind.
5. **H6 late confirm** — Do not confirm if the slot is now occupied.
6. **M7** — Do not overwrite customer PII on phone upsert.
7. **H2** — Re-load user/`isActive`/role on each request.
8. **H8 then H7** — Image type/extension allowlist; same-origin upload serving.

Stop. No code was modified.
