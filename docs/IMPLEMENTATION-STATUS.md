# Implementation status

Last updated: 2026-09-15 (post Milestone 0 build wave)

| Milestone | Status |
|---|---|
| 0 Repository / architecture audit | **VERIFIED** (static) + toolchain/skills |
| 1 Design system + visual redesign | **PARTIAL / IN PROGRESS** — charcoal/champagne tokens live; visual QA pending your inspection (screenshots of dark pages render black in automation) |
| 2 Public website completion | PARTIAL |
| 3 Services/packages/catalog | PARTIAL — public packages now include server `onlinePriceKobo` |
| 4 Booking engine | COMPLETE (code) — `verify:rules` **PASS**; overlap under load still UNVERIFIED beyond existing scripts |
| 5 Bachs + reconciliation | COMPLETE (code) — `verify:payment-flow` skipped this run (API in Bachs mode, not mock) |
| 6 Admin auth/RBAC | COMPLETE (code) — covered by `verify:security` **PASS** |
| 7 Admin CMS/CRM | PARTIAL — discount % editor + required nav aliases |
| 8 Media / object storage | PARTIAL (local) / MISSING (R2) |
| 9 Notifications | PARTIAL |
| 10 Google Calendar + ICS | PARTIAL → ICS VALARM + Google Calendar URL added |
| 11 Policies / cookies | PARTIAL — cookie copy no longer claims GA4 exists |
| 12 Security hardening | PARTIAL → CORS allowlist, Host check (prod), status reference, mock loopback, seed/password, settings key prefixes |
| 13 Database hardening | PARTIAL |
| 14 Responsive / a11y | PARTIAL — lightbox trap + mobile prev/next |
| 15 Full integration QA | UNVERIFIED |
| 16 Production / deployment | PARTIAL |

## This session

**What existed:** NestJS booking/payment/admin rebuild; ivory/teal public UI; verify scripts.

**What changed:** Toolchain + 13 project skills + 13 subagents; Milestone 0 audit docs; design tokens; Book Now package cards; masonry CSS; calendar links; security hardening listed above.

**Tests run:**
- `npm run verify:rules` — PASS
- frontend `tsc -b` — PASS
- backend `tsc --noEmit` — PASS
- `npm run verify:security` — PASS (against restarted API)
- `npm run verify:payment-flow` — FAIL (expected: provider is Bachs, script requires mock)
- Browser: `/` and `/book` — a11y tree OK; `/book` shows grouped cards with server 5% online prices; no public admin link

**Next:** R2 storage, CMS-driven hours, remaining hardcoded 5% marketing copy, full visual inspection, deployment samples.
