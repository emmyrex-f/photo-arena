# Photo Arena — Current Project Snapshot

**Captured:** 2026-09-18 08:51:08 +01:00 (Africa/Lagos)  
**Inspection window:** 2026-09-18 ~08:43–08:55 +01:00  
**Inspector method:** Full static read of `photo arena new` (frontend, backend, Prisma, docs, Docker) plus live process/port/tunnel checks. **No project files were modified except this document.**  
**Active project:** `photo arena new/`  
**Reference only:** `../photo arena old/` (do not treat as the product)

Implemented ≠ verified. Code existing is not a pass. Older docs (`IMPLEMENTATION-STATUS.md` 2026-09-15, `KNOWN-ISSUES.md` 2026-09-15) overstate several security fixes; this snapshot supersedes them for current truth.

---

## 1. Exact current state (runtime)

| Process | State at capture |
|---|---|
| PostgreSQL Docker `photoarena-postgres` | **Up ~2 days, healthy.** Port `5432`. Image `postgres:16`. Compose credentials are the development defaults (`photoarena` / `photoarena`). |
| Vite frontend `localhost:5173` | **Running.** Binds `0.0.0.0:5173` (PID 34520). `GET /` → HTTP 200 (~1629 bytes HTML). |
| NestJS API `localhost:3001` | **Not running.** `GET http://127.0.0.1:3001/api/health` connection refused. Vite proxy `GET /api/health` → **HTTP 500**. Booking, payments, CMS, admin, uploads, and webhooks are down right now. |
| Cloudflare quick tunnel | Process still attached to a terminal (`cloudflared tunnel --url http://localhost:5173`). Public hostname **does not resolve at Cloudflare**. See §11. |
| Tunnel hostname | `https://stopping-prescribed-initially-newfoundland.trycloudflare.com` |
| This machine fetching that URL | PowerShell: **HTTP 530**. WebFetch HTML: **Cloudflare Error 1033** — “unable to resolve” the tunnel hostname. Ray ID `a3cec76b3fb55f1a` at 2026-09-18 07:53:48 UTC. |
| Hero video locally | `frontend/public/LANDSCAPE.mp4` exists, **7.48 MB** (7,845,341 bytes). Local `HEAD` → 200, `Content-Type: video/mp4`, **no `Accept-Ranges` header**. |

**Implication:** A mobile visitor opening the public URL **right now** cannot load the site at all (Cloudflare error page, not Photo Arena). Even if the tunnel recovered, the SPA would load from Vite while every `/api` and `/uploads` call would fail because the API is down. Public pages have some offline fallbacks (`site.ts` / `src/data/*`); booking and admin do not.

---

## 2. Git status

Repo root: `photo arena new/` (workspace folder `photo arena` is **not** a git repo).

| Item | Value |
|---|---|
| Branch | `main` |
| Commits | **None.** `fatal: your current branch 'main' does not have any commits yet` |
| Remote | **None configured** |
| Working tree | Entire tree untracked. `git status --porcelain` ≈ **396** paths |
| `.env` tracking | Root/backend/frontend `.gitignore` ignore `.env`. `backend/.env` and `frontend/.env` exist on disk and were **not** listed as untracked (ignored). Secrets were not printed. |

There is no versioned baseline, no PR history, and no hosted backup of this codebase on a remote.

---

## 3. Stack (what is actually in the tree)

| Layer | Choice |
|---|---|
| Public + admin UI | React 19, Vite 7, TypeScript 5.9, Tailwind 3.4, React Router 7, Framer Motion, react-helmet-async. Admin: Radix/shadcn-style under `frontend/src/admin/`. |
| API | NestJS 11, Express, Prisma 6, PostgreSQL, nodemailer, `@nestjs/schedule`, sharp, bcryptjs, class-validator. Global prefix `/api`. |
| Payments | Provider interface + `BachsPaymentProvider` + `MockPaymentProvider`. |
| Uploads | Local disk (`UPLOADS_DIR` or `backend/uploads/`), static `/uploads`. No R2/S3 SDK. |
| Docker | `docker-compose.yml` = **Postgres only**. No app Dockerfile, no Nginx/Caddy, no systemd/PM2 samples. |
| CI | None in this project. |
| Unit tests | **None** (`*.spec.ts` / `*.test.ts` = 0). Verification is hand-run `tsx` scripts. |

---

## 4. Classification vs confirmed requirements

Source of requirements: `docs/REQUIREMENTS-CONFIRMED.md` (owner-confirmed 2026-09-12, later IA/admin additions 2026-09-13) plus project rules (Sanctum, booking domain, payment security, architecture).

Legend used below:

1. **COMPLETE and verified** — code exists **and** this session (or a current offline script) proved the behaviour.
2. **IMPLEMENTED but not fully verified** — substantial code; not exercised against a live API in this session, or only previously claimed.
3. **INCOMPLETE** — missing, stubbed, or only half-wired.
4. **BROKEN / currently failing** — wrong, drifted, or failing right now.
5. **PRODUCTION BLOCKERS**
6. **DEVELOPMENT-ONLY** — must not ship as-is.

### 4.1 COMPLETE and verified (this session)

| Item | Evidence |
|---|---|
| Pricing math 5% online / 15% reschedule; 30-min slots; 0 buffer; Sunday 12–18 / weekday 08–18; same-day 2h notice; admin can skip notice; overlap helper | `npm run verify:rules` → **PASS** (2026-09-18 08:51+) |
| Bachs webhook HMAC v2/v1 parse helpers + amount-match **helper** unit checks | `npm run verify:bachs-webhook` → **PASS** |
| Vite serves the public HTML | Local `GET /` 200 |
| Hero MP4 file present at `/LANDSCAPE.mp4` | 7.48 MB on disk; local HEAD 200 |
| Postgres container healthy | `docker ps` |
| Frontend production build has succeeded recently | Terminal `209720.txt` 2026-09-17 22:32 UTC: `tsc -b` + `vite build` **succeeded** |
| Backend `tsc --noEmit` + `nest build` succeeded 2026-09-17 | Terminal `387571.txt` |
| Public nav routes exist in router | `App.tsx`: `/` `/about` `/services` `/portfolio` `/book` `/contact` `/faq` `/blog` `/privacy` `/cookies` `/terms` `/policies` |
| Book Now uses server `onlinePriceKobo` / hold `pricing.*` (no client `* 0.95` charge math) | `BookPage.tsx`, `public.service.ts` `onlinePriceKobo` |
| Confirmation page documents waiting on verify/webhook, not return-URL success | `BookConfirmationPage.tsx` |
| Cookie banner categories + consent-gated GA4/Meta loaders in code | `consent.tsx`, `analytics.tsx` |
| Testimonials homepage section hides unless API returns published items | `TestimonialsSection.tsx` (`source !== "api"` → null) |
| ICS download + Google Calendar URL with 24h/2h `VALARM` | `frontend/src/lib/calendar.ts` (client-side only; not a Google API integration) |

### 4.2 IMPLEMENTED but not fully verified

These exist in code. They were **not** re-run against a live API this session because Nest is down. Treat as unverified until `verify:security`, `verify:payment-flow`, CMS/media scripts, and a real Bachs sandbox charge pass on a running stack.

| Area | What exists | Why not “complete” |
|---|---|---|
| Online hold → checkout → webhook/verify confirm | `BookingsService.hold`, `PaymentsService.checkout/verify/handleBachsWebhook`, 15-min hold, expire cron | Needs live API + provider. Last `IMPLEMENTATION-STATUS` (2026-09-15) said `verify:payment-flow` **failed** because provider was Bachs not mock. 2026-09-17 remediation claimed it passed. **Not re-run today.** |
| Occupancy lock | `lockStudioResource` `SELECT … FOR UPDATE` + `slotFits` | GiST exclusion **not** in DB (`20260917140000` is `SELECT 1`). Concurrent overlap under load not re-tested today. |
| Walk-in `PENDING` + studio payment → `CONFIRMED` | Admin bookings controller + `recordStudioPayment` | Not exercised today. Studio payment **accepts optional `amountKobo` from the request body** (`StudioPaymentDto`) — desk can override frozen amount (security audit M3 still relevant). |
| Status machine | `TEMPORARY_HOLD \| PENDING \| CONFIRMED \| COMPLETED \| CANCELLED \| NO_SHOW` in schema + `ALLOWED_STATUS` | Transitions not live-tested today. |
| Bachs hosted checkout + signature webhook | `bachs-payment.provider.ts`, `POST /api/payments/webhook/bachs` | Live/sandbox charge + real webhook delivery **unverified today**. `confirmPayment` does **not** call `providerAmountMatches` before SUCCESS. |
| Mock provider | `PAYMENTS_MOCK` + `POST /payments/mock/complete` | Gated by mock flag + non-production boot guard. **Not** loopback-restricted (`isLoopbackIp` unused). |
| Email notifications + 24h/2h reminders | `NotificationsService` + `ReminderScheduler` | SMTP unset → dry-run logs (seen historically in terminal 28). Recipients configurable in settings. SMS channel is a stub. |
| Admin portal modules | Dashboard, bookings calendar/list, customers, enquiries, services, gallery/media, content/blog/FAQ, testimonials, payments, notifications, users, audit, settings | UI exists. Authz for ADMIN is broken (see §6). Not logged-in today. |
| CMS settings prefixes | `site.` `social.` `hero.` `tour.` `instagram.` `analytics.` `seo.` `policies.` `notifications.` allowlist on PUT | Code present. Round-trip not run today (`verify-cms-m4.ts` exists but is not an npm script). |
| Media library | sharp → WebP, 15 MB, jpeg/png/webp, MediaUsage attach/detach | Local disk only. `verify-*-media.ts` not run today. |
| Public site offline fallback | T-21: settings/services/gallery/FAQ fall back to static data | Useful while API is down; booking still needs API. |
| Contact form | POST `/public/enquiries` then optional Web3Forms if `VITE_WEB3FORMS_KEY` set | No enquiry rate limit (M12 still open). Web3Forms key presence not inspected. |
| Design tokens | Charcoal/champagne in `index.css` (`#0b0d0f` / `#c8b89a`) | Owner visual QA never recorded. `DECISIONS.md` T-17 still says ivory/teal. |

### 4.3 INCOMPLETE

| Item | Requirement | Current gap |
|---|---|---|
| Sanctum desk login | One studio email; **password selects the person** | UI locks email to OWNER via `GET /auth/desk-email`. API `login` looks up **by submitted email**. Result: the official form can only authenticate the OWNER password. An ADMIN password typed into that form is compared to the OWNER hash and fails. Direct API login with a non-owner email still works (see §6). |
| ADMIN permissions persistence | Store and reload `permissions` from DB; JWT has `sub`+`ver` only | DTO + admin UI checkboxes exist. `UsersService` **never reads/writes `permissions`**. `JwtAuthGuard` **does not select `permissions`**. `schema.prisma` **omits** `User.permissions` even though the generated client and baseline SQL include it. |
| CMS hours → availability | Admin can edit `site.hours.*` | Display copy uses CMS hours. Slot engine uses hardcoded `WEEKDAY_OPEN` / `SUNDAY_OPEN` in `availability.ts`. Admin calendar chrome uses a **second copy** in `frontend/src/admin/lib/format.ts`. |
| Object storage | Human-input list still wants R2 for production media | Local `backend/uploads/` only. Lost on container replace if that is ever used. |
| Footer newsletter | Confirmed IA: footer newsletter | `POST /public/newsletter` and admin CSV exist. **No public component calls `subscribeNewsletter`.** Footer has no form. |
| Footer Journal link | D-28: Journal linked from footer | `/blog` exists. Footer Explore list has no Journal. |
| Footer cookie settings | Confirmed: footer cookie settings | Banner + `/cookies` page exist. Footer has legal links only; no “Cookie settings” control. |
| Homepage section order | Hero → portfolio 8 → services → tour → booking CTA → Instagram → testimonials (if published) → footer | Actual: Hero → portfolio → services → **Home About** → tour → **testimonials** → **CTA** → **Instagram**. Extra About block; Instagram after testimonials. |
| Studio tour video | Confirmed homepage item | `site.tour.videoUrl` default `""`. Section renders copy; video only if HEAD of URL is `video/*`. |
| TikTok URL | Confirmed social icon | Left empty on purpose (`site.tiktok: ""`). Do not invent. |
| SMS | Abstraction later | `SmsNotificationChannel` throws / unused. |
| Google Calendar **sync** | Milestone 10 in older status | Only a client “Add to Google Calendar” URL. No Google API, no studio calendar write. |
| Enquiry/newsletter throttle | Security M12 | No rate limit on those POSTs. |
| Helmet / production Host allowlist | Hardening | No helmet. `isTrustedHostHeader` / `TRUSTED_HOSTS` **defined, unused**. |
| Jest/CI/GitHub Actions | Quality gate | Missing. |
| Nginx / HTTPS / VPS deploy samples | Confirmed hosting: VPS | README claims VPS + Nginx. Files absent. |
| Prisma schema = DB | Migrations include `MediaUsage` + `User.permissions` | Checked-in `schema.prisma` has **neither**. Generated client in `node_modules` **has both**. Next `prisma generate` from schema will desync/break MediaUsage + permission types. |
| `prisma:constraints` npm script | Token version + overlap SQL | Script path `prisma/sql/user-token-version.sql` **does not exist**. File lives at `src/common/user-token-version.sql`. Terminal `772509.txt` (`npm run prisma:constraints`) **failed**. Overlap SQL is documentation-only anyway. |
| Seed safety for catalog/CMS | Don’t reset live prices/content | OWNER password is create-only (good). **Every seed still upserts settings values and overwrites package prices** from `seed-data.ts`. |
| Password uniqueness on create/reset | Sanctum: unique passwords | Enforced on self-change / owner account update only. `UsersService.create` / `resetPassword` do **not** call `assertPasswordUnused`. |
| Amount/currency vs Bachs on confirm | Payment-security rule | Helpers exist; `confirmPayment` ignores them. |
| Guest email fallback | — | Checkout uses `guest@photoarenang.com` when customer email missing (hold DTO requires email, so mainly a safety net). |

### 4.4 BROKEN / currently failing

| ID | Severity | Issue |
|---|---|---|
| RUN-1 | **CRITICAL (now)** | Nest API not listening on 3001. Public booking and entire admin API unavailable. Vite `/api` proxy returns 500. |
| RUN-2 | **CRITICAL (now)** | Cloudflare quick-tunnel hostname returns **Error 1033 / HTTP 530**. Public URL does not load on any device, including this machine. |
| AUTH-1 | HIGH | Sanctum not implemented on the server. Login is email+password lookup. Desk UI + that API together mean **only OWNER can sign in through the form**. |
| AUTH-2 | HIGH | ADMIN permission checkboxes are UI theatre. API never persists or reloads them. `toAuthUser` for ADMIN becomes `permissions: []` → `RequirePermission` **denies all desk areas**. |
| AUTH-3 | HIGH | `hasDeskPermission` returns **true for every STAFF**. If a STAFF user authenticates via API (their own email), they get full desk access. |
| SEC-M1 | HIGH | `GET /api/bookings/:id/status` still returns `customer.email` and does **not** require a matching `reference` query. `KNOWN-ISSUES.md` marked this Fixed; **it is not**. `verify-security.ts` calls `?reference=` but the controller ignores it. |
| SEC-H3 | HIGH | CORS remains `app.enableCors({ origin: true })` — reflects any Origin. `IMPLEMENTATION-STATUS` / `KNOWN-ISSUES` claim an allowlist; **false**. `SECURITY-REMEDIATION.md` (2026-09-17) correctly still lists this open. |
| SCHEMA-1 | HIGH | `schema.prisma` missing `MediaUsage` and `User.permissions` while runtime client and migrations have them. |
| PAY-1 | HIGH | Success path does not assert provider amount/currency against frozen `Payment.amountKobo` / `NGN`. |
| TUN-1 | HIGH | When the tunnel *did* receive traffic (06:09 UTC), `/LANDSCAPE.mp4` failed: `stream 801 canceled by remote`. Hero uses `preload="auto"` and keeps the video at `opacity-0` until `loadeddata`/`canplay`. |
| FOOT-1 | MEDIUM | Confirmed footer features (newsletter, Journal, cookie settings) are not in `Footer.tsx`. |
| TERM-1 | LOW | Historical Nest session in terminal 28 shows API **did** boot 2026-09-17 13:57 and later process ended (`last_exit_code: 1`). Not running now. |

### 4.5 PRODUCTION BLOCKERS

Do not put this on `photoarenang.com` until these are closed.

1. **No git history / no remote.** 396 untracked files, zero commits. A disk failure loses the product.
2. **No production deploy path.** Postgres-only Compose; no Nginx, TLS, process manager, backups, or app image. README hosting row is aspirational.
3. **API and tunnel currently down** in the only running environment.
4. **Desk authorization is not Sanctum and is unsafe for ADMIN/STAFF.** OWNER-only operation is the only coherent mode today.
5. **CORS reflect-any** if the API is ever served on a separate origin.
6. **Public booking status leaks PII** (email) without a reference secret.
7. **Webhook confirm does not check amount/currency.**
8. **Mock complete is public whenever `PAYMENTS_MOCK` is on** (no loopback). Production boot refuses mock — good — but a mis-set non-prod tunnel would still expose it.
9. **Local-only media.** No durable object storage; `backend/uploads` gitignored.
10. **Human-input still required for go-live:** live Bachs key + webhook secret, production SMTP, final prices, TikTok URL, analytics IDs, DNS/VPS, Hostinger-plan confirmation. See `docs/HUMAN-INPUT-REQUIRED.md`.
11. **Compose DB password `photoarena`** is a development secret baked in `docker-compose.yml`. Must not be the production database password.
12. **In-memory rate limiter** is per Node process; multi-replica deploy would split limits.
13. **Schema drift** will break `prisma generate` / migrate discipline.
14. **No integration QA this session** (Milestone 15 still unverified).
15. **Seed will clobber CMS settings and catalog prices** if someone runs it against production.

### 4.6 DEVELOPMENT-ONLY (must not reach production)

| Item | Why |
|---|---|
| `PAYMENTS_MOCK=true` (`.env.example` default) | Fake checkout; `POST /api/payments/mock/complete` confirms bookings. |
| Frontend mock branch (`mock=1` query on confirmation) | Only valid with mock provider. |
| `allowedHosts: [".trycloudflare.com"]` in `vite.config.ts` | Vite **dev server** only. Production must be a static build behind Nginx, not `vite dev`. |
| Quick tunnel `*.trycloudflare.com` | Account-less, no SLA, Tokyo PoP observed, currently Error 1033. |
| `#region agent log` POSTs to `http://127.0.0.1:7692/ingest/...` in `SiteLayout.tsx` and `AdminLayout.tsx` | Debug ingest from a mobile-audit session. Harmless if ingest is down; must not ship. |
| Seed defaults `SEED_OWNER_PASSWORD=changeme`, `JWT_SECRET=change-me` in `.env.example` | Fine for local; production `assertCriticalEnv` rejects weak JWT. Still a footgun if copied. |
| Localhost in `PUBLIC_SITE_ORIGINS` / non-prod origin defaults | Checkout allowlist. Production requires https origins. |
| `whsec_local_photo_arena_dev` example webhook secret | Local tests only. |
| `verify-*.ts` synthetic webhook signing | Test helpers. |
| SMTP empty → `[email:dry-run]` | Notifications will not reach the studio. |
| Docker Postgres published on `0.0.0.0:5432` with trivial password | Local convenience; not an internet-facing DB. |
| Vite HMR / `npm run dev` as the public origin | The current tunnel points at the **dev server**, not `vite build` output. |

---

## 5. Frontend (public website + admin)

### 5.1 Public IA vs confirmed nav

Primary nav matches: Home, About, Services, Portfolio, Book Now, Contact (`site.ts` `navLinks`).

Also routed: FAQ, Journal (`/blog`), Privacy, Cookies, Terms, Policies, booking confirmation, 404. `/gallery` → `/portfolio`, `/bookings` → `/book`.

Gaps vs confirmed page spec: footer missing newsletter + Journal + cookie-settings control; homepage order differs; extra Home About block (D-24 said differentiators live on About, not Home — this is a short studio blurb, not a full Why Us, but it is still an extra home section).

### 5.2 Booking UI

Steps: package → schedule → details → hold/pay. Packages grouped by service; shows studio `priceKobo` and server `onlinePriceKobo`. Slots from `GET /bookings/availability`. Hold from `POST /bookings/hold`. Checkout from `POST /bookings/:id/checkout` with matching `reference` and allowlisted return/cancel URLs. Offline package fallback (`src/data/packages.ts`) has **no** `onlinePriceKobo`.

Marketing copy still hardcodes “5%” in `site.ts`, About, CTA, FAQ seed, SEO — display only, not charge math.

### 5.3 Admin portal

Mounted at `/admin/*`. Login page loads desk email read-only. Session in `sessionStorage` (`pa_admin_token`, `pa_admin_user`); restore via `GET /auth/me`.

Nav covers confirmed modules (dashboard, bookings, customers, enquiries, services, gallery, portfolio alias, content, testimonials, payments, notifications, users, audit, settings). Hidden nav is **not** security; API guards are supposed to be. Those guards currently fail closed for ADMIN and fail open for STAFF (§6).

Users UI sends `fullAccess` / `permissions` on create/patch; backend ignores them.

### 5.4 Design

Tokens in `index.css` are charcoal/champagne, not the older ivory/teal. `IMPLEMENTATION-STATUS` UI-1 (“still ivory/teal”) is **stale**. Visual sign-off from Emmanuel is still **unverified**. Automation screenshots of dark pages were previously reported as unreliable.

No frontend test/lint scripts.

---

## 6. Authentication and permissions (Sanctum)

**Required:** one OWNER email on the form; password selects among active desk users; passwords unique; JWT `sub` + `tokenVersion` only; reload role/permissions/`isActive` from DB every request; OWNER full; ADMIN limited to stored permissions; OWNER-only user CRUD.

**Implemented today:**

- `GET /auth/desk-email` returns active OWNER email.
- Login generic error: `"Email or password is incorrect"`.
- JWT payload `{ sub, ver }`, 8h, HS256.
- `JwtAuthGuard` reloads `id, email, name, role, isActive, tokenVersion`; rejects inactive or version mismatch; **does not load `permissions`**.
- `tokenVersion` increments on password change, deactivate, role change, reset.
- User create/patch/delete/reset: `@Roles(OWNER)` on mutating routes.
- Password uniqueness on **change-password / update-account only**.

**Not implemented / incorrect:**

- Login is `findUnique({ email })` + bcrypt. It does **not** `assert.equal(dto.email, owner.email)` and does **not** `matchActiveUserByPassword`.
- Combined with the locked UI email, **ADMIN cannot sign in at the official form**.
- Combined with the open API, anyone who knows an admin’s **own** email+password can `POST /auth/login` and get a token (if that ADMIN’s empty permission list then blocks them from the desk — see next point).
- ADMIN permissions never saved, never selected, so `toAuthUser` yields `[]`. `RequirePermission` then 403s the whole desk for ADMIN.
- STAFF is treated as full access in `hasDeskPermission`.

**Verdict:** OWNER-only desk may work. Multi-admin Sanctum is **incomplete and, for STAFF, dangerous**. Do not mark Milestone 6 complete.

---

## 7. Prisma schema and migrations

Checked-in models: `User`, `StudioResource`, `Customer`, `Service`, `Package`, `Booking`, `Payment`, `ProcessedWebhookEvent`, `PricingRule`, `NotificationRecipient`, `NotificationLog`, `BusinessSettings`, `GalleryImage`, `Testimonial`, `Faq`, `Enquiry`, `NewsletterSubscriber`, `BlogPost`, `AuditLog`.

Enums include required booking/payment statuses and `Role` OWNER/ADMIN/STAFF.

Migrations:

| Migration | Content |
|---|---|
| `20260914150000_security_hardening` | `SELECT 1` no-op |
| `20260916114500_baseline` | Full baseline, **includes** `User.permissions` TEXT[] |
| `20260916114600_add_media_usage` | `MediaUsage` table + FK to `GalleryImage` |
| `20260917140000_booking_overlap_exclude` | `SELECT 1`; comments that GiST was not applied |

`node_modules/.prisma/client` currently types `MediaUsage` and `User.permissions`. `schema.prisma` does not. This is active drift.

---

## 8. API surface (Nest, prefix `/api`)

Unauthenticated (selected): `GET /health`, `GET /auth/desk-email`, `POST /auth/login`, public settings/services/gallery/testimonials/faqs/blog, `POST /public/enquiries`, `POST /public/newsletter`, `GET /bookings/availability`, `GET /bookings/packages`, `POST /bookings/hold` (rate limited), `GET /bookings/:id/status` (**PII**), `POST /bookings/:id/checkout`, `GET /payments/verify`, `POST /payments/mock/complete` (mock flag), `POST /payments/webhook/bachs`.

Authenticated desk: dashboard, bookings CRUD/status/pay/reschedule, payments list/export/summary/integration, customers, enquiries, catalog, gallery, media-usages, settings, blog, faqs, newsletter, testimonials, notifications, users (OWNER writes), audit.

Global `ValidationPipe`: whitelist, transform, forbidNonWhitelisted. Settings PUT disables that pipe and uses prefix allowlist instead.

---

## 9. Bookings and availability

`BOOKING_RULES`: 30-minute increment, 0 buffer, 120-minute same-day notice, 15-minute hold, `Africa/Lagos`. Process `TZ` defaults to `Africa/Lagos`. Times stored as UTC `DateTime`.

Online hold freezes `amountKobo` + `reference`. Caps: 3 active holds per phone; IP/phone flood limits. Blocking statuses: unexpired `TEMPORARY_HOLD`, `PENDING`, `CONFIRMED`.

Hours are **code constants**, not CMS. Confirmed studio hours currently match those constants (08–18 / 12–18), so behaviour is correct **until** someone edits hours in admin.

Reschedule: admin; snapshot cancelled booking; 15% fee from `PricingService` on original package price. No customer cancel/refund in public API.

---

## 10. Bachs payments and webhooks

- Checkout creates/reuses PROCESSING payment; currency `"NGN"`; return/cancel URLs allowlisted (`PUBLIC_SITE_ORIGINS` + localhost in non-prod).
- Confirm via `verify` (provider) or webhook; return URL is not trusted. Idempotent `updateMany` where not SUCCESS + `ProcessedWebhookEvent`.
- Webhook success: `collection.succeeded`; `checkout.completed` only if `payment_status === "paid"`. Fail: `collection.failed`. Abandoned/underpaid/expired/refund: ack only.
- Late pay: occupancy re-check; if taken → payment SUCCESS, booking not CONFIRMED, `PAID_UNPLACED` note.
- `expireHolds` cron every minute; skips holds that already have SUCCESS payment (per remediation notes).
- Admin `GET /admin/payments/integration` returns non-secret status (prefix detect sandbox vs live).
- Production boot: mock forbidden; `BACHS_API_KEY` required. **This session did not read `.env` values** (blocked as credential handling). Example file documents mock-on for local.

**Unverified today:** real Bachs sandbox session, webhook from Bachs cloud to this machine (the current tunnel does not expose `:3001` anyway).

---

## 11. Cloudflare tunnel / mobile load failure (investigation only — no fix applied)

### 11.1 What is running

Command (terminal 64, still active):

```text
cloudflared tunnel --url http://localhost:5173
```

Settings from the log: version `2026.9.1`, Windows, `ha-connections:1`, **`protocol:quic`**, origin `http://localhost:5173` only (not the API). Connector IDs registered at Cloudflare colo **`nrt01` then `nrt15` (Tokyo)**.

Vite is tunnel-aware: `host: true` (0.0.0.0), `allowedHosts: [".trycloudflare.com"]`, proxies `/api` and `/uploads` to `http://localhost:3001`. Default HMR (no `server.hmr` host/clientPort). That config is sufficient for a **working** quick tunnel to reach the Vite HTML. It does not make the tunnel reliable, and it does not start the API.

### 11.2 Why a phone would fail — ranked

**A. The hostname is dead right now (blocks everyone, not just mobile).**  
This machine received Cloudflare **Error 1033** / HTTP **530**: the edge cannot resolve `stopping-prescribed-initially-newfoundland.trycloudflare.com`. Quick tunnels are ephemeral and account-less; the log even warns they have no uptime guarantee. After QUIC timeouts and idle `HTTP/1.1 400` noise, registration was lost while `cloudflared` still looked “running”. A phone opening the chat-shared URL hits a Cloudflare error page.

**B. When the tunnel was alive, the hero video request died.**  
At 06:09:27 UTC the origin log recorded:

```text
error="stream 801 canceled by remote with error code 0"
dest=https://stopping-prescribed-initially-newfoundland.trycloudflare.com/LANDSCAPE.mp4
```

The homepage always requests `/LANDSCAPE.mp4` (`preload="auto"`, autoplay, loop). The file is **7.48 MB**. Vite’s HEAD response had **no `Accept-Ranges`**. Mobile Safari in particular uses byte-range requests for `<video>`. A canceled 8 MB download over a single QUIC connection is enough for the hero to never fire `loadeddata`. The video stays `opacity-0`; the section is charcoal (`#0b0d0f`) with white copy and a glow, so the page is not literally white, but it can look “stuck”, empty, or broken — especially on a slow radio link.

**C. QUIC + one connection + Tokyo PoP is hostile to Nigerian mobile.**  
`failed to accept QUIC stream: timeout: no recent network activity` then retry. Many mobile networks interfere with UDP/QUIC. `ha-connections:1` means any drop stalls every in-flight asset (HTML, JS, 8 MB video). The connector is registered in **Tokyo** while the audience is Port Harcourt — high RTT even before radio loss.

**D. Backend is down, so a recovered tunnel still cannot book or load CMS media.**  
Tunnel target is only `:5173`. API lives on `:3001` via Vite proxy. Proxy `/api/health` is **500** today. Public pages degrade to static fallbacks; Book Now / confirmation / admin cannot.

**E. Secondary aggravators (not the primary 1033):**

- Account-less `trycloudflare.com` often shows a browser integrity / “just a moment” interstitial that some mobile browsers fail.
- Vite HMR websocket (dev server, default ports) can hang or spam failed WS connections on phones.
- Windows cloudflared log: cannot load the system root CA pool (origin is HTTP localhost, so this is secondary).
- `TRUST_PROXY` default in example is false; if the API were exposed behind Cloudflare without it, rate-limit IPs would be wrong (not the load-failure cause).
- Tunnel does **not** publish `/api/payments/webhook/bachs` to the internet unless someone also tunnels `:3001`. Sandbox webhooks cannot hit this laptop through the current command.

**F. What this is not:**  
Not a `allowedHosts` mismatch for `*.trycloudflare.com` (that list is present). Not “Vite bound to localhost only” (`0.0.0.0:5173` is listening). Not a missing MP4 (file exists). Not a production Nginx bug (there is no Nginx).

No code or tunnel config was changed.

---

## 12. Notifications and calendar

| Feature | State |
|---|---|
| Dual email recipients | Settings `notifications.recipients` or `NOTIFICATION_EMAIL_RECIPIENTS` |
| Events | created, confirmed, payment received, reminder, rescheduled, cancelled, payment failed — templates in `NotificationsService` |
| SMTP | Optional; absent → dry-run logs (observed 2026-09-17 in terminal 28) |
| 24h / 2h reminders | Cron ±5 min windows; historically did fire (`ReminderScheduler` log 2026-09-17 14:25) |
| SMS | Stub |
| Customer ICS / Google URL | Client-only on confirmation page |
| Studio Google Calendar | Not implemented |

---

## 13. CMS / media / public content

Admin Content + Gallery/Media Library + MediaUsage attachments (service, homepage gallery, portfolio, blog, content, testimonial). Uploads re-encoded to uuid WebP; path traversal blocked in gallery service. Served from `/uploads` with `nosniff`.

Public gallery also uses `/gallery/*` seeded filenames under `frontend/public/gallery`.

`tmp-audit-imgs/` exists under the new project (older docs said missing). Not treated as production media.

---

## 14. Environment and configuration

Documented in `backend/.env.example` (names only): `DATABASE_URL`, `PORT`, `TZ`, `BACHS_API_KEY`, `BACHS_WEBHOOK_SECRET`, `BACHS_BASE_URL`, `PUBLIC_API_URL`, `NOTIFICATION_EMAIL_RECIPIENTS`, `SMTP_*`, `JWT_SECRET`, `PAYMENTS_MOCK`, `TRUST_PROXY`, `PUBLIC_SITE_ORIGINS`, `SEED_OWNER_*`.

Also used in code: `NODE_ENV`, `UPLOADS_DIR`, `PUBLIC_URL`, `TRUSTED_HOSTS`, `API_BASE` (scripts).

Frontend `.env.example`: `VITE_API_URL=/api`, `VITE_WEB3FORMS_KEY=`.

Production boot checks: strong JWT, https `PUBLIC_SITE_ORIGINS`, no mock, Bachs key present.

Local `.env` files exist and are gitignored. Values were not dumped in this snapshot.

---

## 15. Docker / deployment

- `docker-compose.yml`: Postgres 16, port 5432, volume `photoarena_pg`, healthcheck. **No API/web services.**
- No Dockerfile, nginx.conf, Caddyfile, deploy scripts, GitHub Actions.
- README “Hosting: VPS + Nginx” is not backed by files.
- Current “public URL” is a **developer quick tunnel in front of `vite dev`**, which is not a production topology.

---

## 16. Security (honest vs older “fixed” lists)

| Control | Current code | Older doc claim |
|---|---|---|
| CORS | `origin: true` | STATUS/KNOWN-ISSUES: allowlist **Fixed** — **wrong** |
| Host header | helper unused | STATUS: Host check in prod — **wrong** |
| Mock complete loopback | not enforced | KNOWN-ISSUES: loopback-only **Fixed** — **wrong** |
| Status PII | email still returned; no required reference | KNOWN-ISSUES: **Fixed** — **wrong** |
| Seed OWNER password reset | create-only | KNOWN-ISSUES: **Fixed** — **correct for password**; seed still overwrites prices/settings |
| JWT role in token | ignored; DB reload | Remediation: Done — **correct**, minus permissions column |
| Checkout URL allowlist | implemented | Remediation: Done — **code present**, not live-tested today |
| Upload XSS/path | sharp + allowlist + nosniff | Remediation: Done — **code present** |
| Login/hold rate limits | in-memory | Remediation: Done — **code present** |
| Settings key allowlist | prefixes in controller | Remediation 2026-09-17 listed M10 open; **code now has allowlist** |
| Helmet | absent | — |
| Enquiry throttle | absent | M12 open |

---

## 17. Tests / verification scripts

npm scripts: `verify:rules`, `verify:bachs-webhook`, `verify:payment-flow`, `verify:security`.

Present but **not** wired in `package.json`: `verify-bachs-e2e.ts`, `verify-cms-m4.ts`, `verify-media-usage.ts`, `verify-portfolio-media.ts`, `verify-service-media.ts`, `verify-testimonial-media.ts`, `diagnose-bachs-m4a.ts`.

**This session:**

| Script | Result |
|---|---|
| `verify:rules` | PASS |
| `verify:bachs-webhook` | PASS |
| `verify:security` | **Not run** (API down) |
| `verify:payment-flow` | **Not run** (API down) |
| Frontend/backend `tsc` | Not re-run today; last known success 2026-09-17 |
| Browser admin/public click-through | **Not done** (tunnel 1033, API down) |

`verify-security.ts` still logs in additional users **by their own email**, which documents that the API is not Sanctum-single-email.

---

## 18. Stale documentation (do not trust blindly)

| Doc | Date | Problem vs 2026-09-18 code/runtime |
|---|---|---|
| `IMPLEMENTATION-STATUS.md` | 2026-09-15 | Claims CORS allowlist, Host check, mock loopback, Milestone 6 complete |
| `KNOWN-ISSUES.md` | 2026-09-15 | Marks SEC-H3 / status PII / mock loopback / seed password as Fixed |
| `IMPLEMENTATION-AUDIT.md` | 2026-09-15 | Still describes ivory/teal, flat Book Now select, missing masonry, missing calendar URL — those UI items have since changed in code |
| `DECISIONS.md` T-17 | 2026-09-12/13 | Ivory/teal hybrid; CSS is now charcoal/champagne |
| `HUMAN-INPUT-REQUIRED.md` | ~2026-09-16 | `temp-audit-imgs` now exists; other human items still valid |
| `PROJECT-SNAPSHOT.txt` | 2026-09-13 | Pre-dates Sanctum work, media usage, security batch |

`SECURITY-REMEDIATION.md` (2026-09-17) is the most accurate **security** write-up, except M10 (settings prefixes) now appears implemented, and it does not cover Sanctum/permission drift or the live 1033/API-down outage.

---

## 19. What this snapshot could not verify

- Contents of `.env` (on purpose).
- Live Bachs sandbox or live charges.
- SMTP delivery to real mailboxes.
- Admin click-paths, calendar drag/reschedule, CSV exports.
- Concurrent hold race on this database today.
- Mobile device on a cellular network (inferred from tunnel logs + Cloudflare error; not a phone lab).
- Whether `User.permissions` / `MediaUsage` columns actually exist in the running Postgres (client types say yes; `schema.prisma` says no). A `prisma db pull` was not run.

---

## 20. Bottom line

The rebuild is a real Nest + React studio product: booking rules, Bachs adapter, admin CMS, and a charcoal public site are in source. It is **not production-ready** and **not healthy in the current process set**.

Right now the stack is: **Postgres up, Vite up, API down, public Cloudflare URL returning Error 1033.** Sanctum is not actually implemented. Several items marked Fixed in mid-September docs are still open in code (CORS, status PII, mock loopback). The mobile URL problem is primarily a **dead/unreliable quick tunnel plus an 8 MB autoplay hero video over QUIC**, not a missing `allowedHosts` flag.

Highest-priority work (when changes are allowed): restore a running API; stop using account-less quick tunnels as a demo path (or use a named tunnel + HTTP/2 + also expose/proxy the API); do not treat `vite dev` as production; finish Sanctum (password-selects-user, persist/reload permissions, unique passwords on create); align Prisma schema with the database; close CORS/PII/amount-match; add a real deploy story; commit to a remote.
