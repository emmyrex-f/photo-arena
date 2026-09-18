# Known issues

Do not hide failures. Update when fixed.

## Open (from 2026-09-15 audit)

| ID | Severity | Issue | Status |
|---|---|---|---|
| UI-1 | HIGH | Public site still ivory/teal, not charcoal/champagne tokens | **Fixed in tokens** — pending Emmanuel visual inspection |
| UI-2 | HIGH | Book Now packages are a flat select; client 5% estimate | **Fixed** — grouped cards + server `onlinePriceKobo` |
| UI-3 | HIGH | Portfolio `.masonry` has no CSS | **Fixed** (CSS columns) — pending visual inspection |
| CAL-1 | MEDIUM | No Google Calendar URL; ICS has no 24h/2h VALARM | **Fixed** |
| SEC-H3 | HIGH | CORS `origin: true` | **Fixed** — `PUBLIC_SITE_ORIGINS` allowlist |
| SEC-M1 | HIGH | `GET /bookings/:id/status` leaks email | **Fixed** — matching `reference` required |
| SEC-C1b | HIGH | Public mock complete if tunneled with `PAYMENTS_MOCK` | **Fixed** — loopback-only |
| SEC-SEED | HIGH | Seed resets OWNER password and discount bps | **Fixed** |
| CMS-1 | HIGH | Pricing rule PATCH requires `bps`; UI sends only `isActive` | **Fixed** — optional DTO + percent editor |
| CMS-2 | MEDIUM | Opening hours in CMS do not drive `availability.ts` | Open at audit |
| MED-1 | HIGH | No S3/R2; uploads are container-local | Open at audit |
| MED-2 | MEDIUM | `temp-audit-imgs` not in workspace | Blocked |
| SOC-1 | LOW | Official TikTok not confidently verified — left empty | Blocked on client |
| DEP-1 | HIGH | No Nginx/app Docker; Hostinger plan unverified | Open |

## Won't fake

- TikTok URL  
- Bachs live charges without keys  
- Legal claims beyond confirmed studio rules  
