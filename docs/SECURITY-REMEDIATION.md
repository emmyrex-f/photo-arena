# Photo Arena — Security Remediation Report

**Date:** 2026-09-17  
**Scope:** Confirmed issues from `docs/SECURITY-AUDIT.md`, implemented in approved order.  
**Constraint:** Hardening only. Pricing, slot rules, webhook HMAC, and payment idempotency were not rewritten.

No secrets, keys, passwords, or tokens are recorded here.

---

## C1 — Mock payment completion

| | |
|---|---|
| **Status** | Done |
| **Root cause** | Mock mode was inferred from a missing Bachs key. `POST /api/payments/mock/complete` was public. |
| **Fix** | Mock only when `PAYMENTS_MOCK=true` **and** `NODE_ENV` is not `production`. Production refuses to boot if mock is on or `BACHS_API_KEY` is missing. `mockComplete` uses the same flag. HMAC and `ProcessedWebhookEvent` unchanged. |
| **Files** | `src/common/payments-mock.ts`, `src/payments/payments.module.ts`, `src/payments/payments.service.ts`, `src/main.ts` |
| **Database** | None |
| **Env** | `PAYMENTS_MOCK` |
| **Tests** | Unit: production boot without key throws. Live API: mock complete → 403 when flag is off. |
| **Result** | Pass |

---

## H4 — Hold flooding / H1 — Login brute force

| | |
|---|---|
| **Status** | Done |
| **Root cause** | Unbounded public hold and login. |
| **Fix** | In-memory limiter (single Node process). Hold: 10/15 min/IP, 5/15 min/phone, max 3 active holds per phone. Login: 5 failures/15 min per IP and email; generic error; no password/token logs. `TRUST_PROXY` enables Express `req.ip`. Webhook is not throttled. |
| **Files** | `src/common/rate-limit.ts`, `src/common/client-ip.ts`, `src/bookings/bookings.controller.ts`, `src/bookings/bookings.service.ts`, `src/auth/auth.controller.ts`, `src/main.ts` |
| **Database** | None |
| **Env** | `TRUST_PROXY` |
| **Tests** | 4th active hold same phone → 409. 11th hold same IP → 429. 6th failed login → 429. Valid login → 200. |
| **Result** | Pass |

---

## H5 — Concurrent booking race

| | |
|---|---|
| **Status** | Done (row lock). Exclusion constraint **not applied** — see compromises. |
| **Root cause** | Read-then-insert under READ COMMITTED. |
| **Fix** | `SELECT id FROM "StudioResource" WHERE id = $1 FOR UPDATE` in hold, admin create, and reschedule (and payment confirm). `slotFits` unchanged. Overlap DB errors map to 409. |
| **Files** | `src/bookings/resource-lock.ts`, `src/bookings/bookings.service.ts`, `src/payments/payments.service.ts` |
| **Database** | No GiST exclusion (PostgreSQL rejects timestamptz range expressions as not IMMUTABLE). `User.tokenVersion` already in schema. |
| **Env** | None |
| **Tests** | Two parallel holds, same slot → one 200, one 409. Adjacent slots → both succeed. |
| **Result** | Pass |

---

## H6 — Late payment confirmation

| | |
|---|---|
| **Status** | Done |
| **Root cause** | `confirmPayment` set `CONFIRMED` without occupancy check. |
| **Fix** | Lock resource. `updateMany` not-SUCCESS remains idempotent. If slot free (including expired hold) → `CONFIRMED`. If slot taken → payment `SUCCESS`, booking not confirmed, `PAID_UNPLACED` note, studio notified, no `booking_confirmed`. `expireHolds` skips holds with SUCCESS payment. Return URL still does not confirm. HMAC + duplicate event id unchanged. |
| **Files** | `src/payments/payments.service.ts`, `src/bookings/bookings.service.ts` (`expireHolds`) |
| **Database** | None |
| **Env** | None |
| **Tests** | Expired + free + webhook → CONFIRMED. Expired + slot taken + webhook → SUCCESS, not CONFIRMED. Duplicate webhook → `duplicate: true`. |
| **Result** | Pass |

---

## M7 — Customer phone overwrite

| | |
|---|---|
| **Status** | Done |
| **Root cause** | Online hold `upsert` updated name/email. |
| **Fix** | Find by phone; create if missing; otherwise attach only. Admin create still upserts (desk-initiated). |
| **Files** | `src/bookings/bookings.service.ts` (`hold`) |
| **Database** | None |
| **Env** | None |
| **Tests** | Second hold with same phone, different name/email → stored PII unchanged. |
| **Result** | Pass |

---

## H2 — Stale JWT

| | |
|---|---|
| **Status** | Done |
| **Root cause** | Guard trusted JWT `role`; no DB reload. |
| **Fix** | Verify JWT (`sub` + `ver` only). Load user; require `isActive`; role from DB via `toAuthUser`. `tokenVersion` increment on deactivate, role change, password change, reset. 8h expiry kept. Tokens not logged. |
| **Files** | `src/auth/jwt-auth.guard.ts`, `src/auth/auth.service.ts`, `src/users/users.service.ts`, `prisma/schema.prisma` (`tokenVersion`) |
| **Database** | `User.tokenVersion` INTEGER NOT NULL DEFAULT 0 (already in baseline; `prisma/sql/user-token-version.sql` is repeatable). |
| **Env** | `JWT_SECRET` (existing) |
| **Tests** | Deactivate → old token 401. Demote ADMIN→STAFF → OWNER-only create user 403. Password change → old token 401. |
| **Result** | Pass |

---

## H8 / H7 — Upload XSS / path traversal

| | |
|---|---|
| **Status** | Done |
| **Root cause** | `kind` used as a directory; client MIME/extension trusted; original bytes written. |
| **Fix** | Allowlist `gallery`/`blog`/`content` before FS use. `assertInsideUploads` on write and delete. Sharp decode jpeg/png/webp only; reject SVG/HTML. Re-encode to `uuid.webp`. Serve `/uploads` with `nosniff` + image Content-Type. OWNER/ADMIN + 15 MB / 10 files kept. |
| **Files** | `src/common/upload-path.ts`, `src/gallery/gallery.service.ts`, `src/main.ts` |
| **Database** | None |
| **Env** | None |
| **Tests** | SVG → 400. JPEG → 201 `.webp`. `kind=../../../tmp` → 400. |
| **Result** | Pass |

---

## C2 / M2 — Checkout return/cancel URL

| | |
|---|---|
| **Status** | Done |
| **Root cause** | Checkout needed only booking id; any URL accepted. |
| **Fix** | Body `reference` must match booking. `returnUrl`/`cancelUrl` allowlisted to `PUBLIC_SITE_ORIGINS` (plus localhost in non-prod) and paths `/book/confirmation` and `/book`. HTTPS required in production. Guest checkout, active hold, frozen `amountKobo` unchanged. CORS not widened. `allowedHosts: true` not used. |
| **Files** | `src/common/site-origins.ts`, `src/bookings/dto/hold-checkout.dto.ts`, `src/payments/payments.controller.ts`, `src/payments/payments.service.ts`, `frontend/src/lib/publicApi.ts`, `frontend/src/pages/BookPage.tsx` |
| **Database** | None |
| **Env** | `PUBLIC_SITE_ORIGINS` |
| **Tests** | Evil origin → 400. Wrong reference → 400. Matching reference + localhost origin → 200. |
| **Result** | Pass |

---

## Environment variables (added / documented)

| Variable | Purpose |
|---|---|
| `PAYMENTS_MOCK` | `true`/`1` enables mock checkout only when `NODE_ENV` is not `production`. |
| `TRUST_PROXY` | `true`/`1` — trust one proxy hop so rate limits use `req.ip`. |
| `PUBLIC_SITE_ORIGINS` | Comma-separated origins allowed as checkout return/cancel URLs. Required https in production (`assertCriticalEnv`). |

Documented in `README.md` and `backend/.env.example`.

---

## Tests performed

| # | Check | Result |
|---|---|---|
| 1 | `npm run verify:rules` | Pass |
| 2 | `npm run verify:payment-flow` | Pass (accepts mock or Bachs provider) |
| 3 | Production boot without Bachs key | Pass (unit) |
| 4 | Mock complete with flag off | Pass (403) |
| 5 | Two simultaneous holds | Pass |
| 6 | Adjacent slots | Pass |
| 7 | Four active holds same phone | Pass |
| 8 | Hold flood same IP | Pass (429) |
| 9–10 | Login brute force / valid login | Pass |
| 11–13 | JWT deactivate / demote / password change | Pass |
| 14–16 | SVG / JPEG webp / path traversal | Pass |
| 17–19 | Evil URL / wrong ref / good checkout | Pass |
| 20–22 | Late confirm free / taken / duplicate webhook | Pass |
| M7 | Phone PII preserved | Pass |
| extra | `npm run verify:bachs-webhook` | Pass |

---

## Remaining confirmed issues (not in this batch)

From the second-pass audit, **not** approved here:

- **H3** — CORS still `origin: true` in `main.ts` (this pass forbade widening CORS; tightening allowlist is a follow-up).
- **M12** — Enquiry/newsletter throttle.
- Policy gaps: studio payment body amount (M3), amount/currency vs Bachs (H6 policy), settings key allowlist (M10).

---

## Remaining manual verification

- Production `BACHS_API_KEY` present and `PAYMENTS_MOCK` off (boot check covers this if `NODE_ENV=production`).
- Production `JWT_SECRET` length/strength (`assertCriticalEnv` in production).
- Nginx: whether `/uploads` shares the admin origin (H8 XSS impact).
- Multi-process deploy: in-memory rate limiter is per process; a second Node replica would need a shared store.

---

## Implementation compromises

1. **H5 GiST exclusion** — PostgreSQL will not index `tstzrange(timestamptz, …)` (not IMMUTABLE). Concurrency is **`SELECT … FOR UPDATE` on `StudioResource`**, which is sufficient for one studio resource. SQL left as documentation (`prisma/sql/booking-overlap-exclude.sql`).
2. **Rate limiter** — in-memory, one Node process (documented).
3. **JWT payload** — `sub` + `ver` only; role always from DB. Old 8h tokens with extra claims still verify if `ver` matches.

---

## Blockers

None. The approved batch is implemented and the listed tests passed against the running local API.

Webhook signatures, `ProcessedWebhookEvent` idempotency, 5% online discount, 15-minute holds, 30-minute slots, 2-hour notice, no buffer, full package duration, one session at a time, no customer cancel/refund, 15% reschedule fee, and admin role guards were not removed or redesigned.
