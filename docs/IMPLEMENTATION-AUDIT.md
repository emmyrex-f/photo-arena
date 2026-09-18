# Photo Arena — Implementation Audit (Milestone 0)

**Date:** 2026-09-15  
**Project:** `photo arena new`  
**Method:** Static inspection of frontend, NestJS, Prisma, verify scripts, and docs. Runtime verification is a separate column.  
**Legend:** COMPLETE · PARTIAL · BROKEN · MISSING · INSECURE · UNVERIFIED  

Implemented ≠ Verified. Code existing is not a pass.

This document is the backlog for milestones 1–16. Do not rebuild working booking/payment engines.

---

## Executive judgment

The rebuild is **past prototype**. NestJS owns pricing, holds, Bachs webhooks, JWT+tokenVersion, and a working admin CMS. The public site is still on the **old ivory/teal palette**, Book Now uses a **flat package dropdown**, portfolio **masonry CSS is missing**, Google Calendar is **missing**, and production media is **local disk only**.

Treat booking and payment as **UNVERIFIED** until `verify:*` scripts pass against a running API in this session.

---

## Classification

| Deliverable | Status | Evidence | Gap |
|---|---|---|---|
| Public routes (home, about, services, portfolio, book, contact, legal) | PARTIAL | `frontend/src/App.tsx` | Palette, masonry, hardcoded fallbacks |
| Design system (charcoal/champagne tokens) | BROKEN | `frontend/src/index.css`, `lib/theme.ts` still ivory/teal/amber | Replace green/teal system |
| Book Now package UX | PARTIAL | `BookPage.tsx` single `<select>` | Cards grouped by service; client `0.95` estimate |
| Availability / 30-min / 2h notice / 15-min hold | COMPLETE (code) / UNVERIFIED | `availability.ts`, `bookings.service.ts`, `verify-rules.ts` | Hours hardcoded, not CMS |
| Overlap / concurrent holds | PARTIAL / UNVERIFIED | `resource-lock.ts`; optional SQL `booking-overlap-exclude.sql` | Holds not in DB exclusion; SQL not in Prisma migrate |
| Online discount configurable | PARTIAL | `PricingRule` + `PricingService` | Admin toggle omits `bps` (likely BROKEN); frontend 5% hardcode; no `refresh()` on PATCH |
| Frozen historical amounts | COMPLETE (code) | `Booking.amountKobo` at hold | Checkout fallback to list price if null |
| Bachs checkout + webhook + idempotency | COMPLETE (code) / UNVERIFIED | `payments.service.ts`, verify scripts | Live keys needed |
| Frontend never confirms payment | COMPLETE | `BookConfirmationPage.tsx` | — |
| Mock payments production-safe | COMPLETE (prod) / INSECURE (tunneled mock) | `payments-mock.ts`; public `mock/complete` | Restrict mock complete to loopback |
| Google Calendar | MISSING | — | Confirmation page |
| ICS | PARTIAL | Client `buildIcs()` | No VALARM 24h/2h |
| Reminders 24h/2h | PARTIAL / UNVERIFIED | `reminder.scheduler.ts` | SMTP often unset |
| Admin portal CRUD | PARTIAL | Full desk except IA | Calendar/Packages/Portfolio/Testimonials/Messages not first-class nav |
| Admin API authz | COMPLETE (code) / UNVERIFIED | Jwt + Roles on `/api/admin` | — |
| Public `/admin` advertised | COMPLETE (hidden) | No footer/nav link | Direct URL still shows login (expected) |
| CORS | INSECURE | `main.ts` `origin: true` | Allowlist `PUBLIC_SITE_ORIGINS` |
| Booking status PII | INSECURE | `GET /bookings/:id/status` returns email | Require matching `reference` |
| Uploads | COMPLETE (dev) / MISSING (prod object storage) | sharp + path allowlist | Cloudflare R2 adapter |
| Portfolio masonry | BROKEN | `.masonry` class, no CSS | Add editorial columns |
| Cookie consent | PARTIAL | Banner + gated loaders | Banner labels “GA4” even when unconfigured |
| Policies | PARTIAL | `/policies` `/terms` `/privacy` `/cookies` | 2-hour notice not on booking path |
| Object storage | MISSING | Local `backend/uploads/` | R2 |
| `temp-audit-imgs` | MISSING | Not in workspace | Asset mapping blocked |
| Official TikTok | UNVERIFIED | `site.tiktok` empty; TikTok page not confidently verified | Do not invent URL |
| Jest/CI | MISSING | Five `verify-*.ts` scripts only | No GitHub Actions |
| Docker/Nginx/HTTPS | PARTIAL | Compose = Postgres only | VPS samples |
| Env validation | PARTIAL | Payment prod guard only | JWT strength, origins |
| Seed safety | INSECURE | Seed resets OWNER password + discount bps | Create-only for secrets/prices |

Prior security audit (`docs/SECURITY-AUDIT.md`, 2026-09-14): C1 (prod), C2, H1, H2, H4, H6, H7, H8 (code) are **FIXED**. Still open: H3 CORS, M1 PII, mock-on-tunnel, seed footgun.

---

## Tooling (prerequisite)

See `docs/ENGINEERING-TOOLCHAIN.md`. Marketplace plugins cannot be agent-installed. Project skills live in `.cursor/skills/`. Subagents in `.cursor/agents/`.

---

## Parallel workstreams after this audit

1. **Frontend visual + Book Now + masonry + calendar** (`frontend/src` public)  
2. **Security hardening** (`main.ts`, bookings status, mock complete, seed, CORS)  
3. **Pricing CMS** (DTO, refresh, admin percent editor, public `onlinePriceKobo`)  
4. **Admin IA** (nav aliases)  
5. **Media R2** (after 1–4; new adapter, no schema fight with booking)  
6. **Deployment samples** (nginx, env checklist)

Serialize: Prisma migrations; payment/booking status machine.

---

## Verification required this session

- `npm run verify:rules`  
- `npm run verify:security` and `verify:payment-flow` if API is up  
- Browser: `/`, `/book`, `/portfolio`, `/admin/login`  
