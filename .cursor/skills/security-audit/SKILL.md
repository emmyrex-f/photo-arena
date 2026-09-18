---
name: security-audit
description: Aggressive Photo Arena application security audit covering auth, RBAC, JWT versioning, payments, uploads, Host/origin, IDOR, and admin exposure. Use for /security-audit, Milestone 12, or before production.
---

# Security Audit

Assume hostile users. Frontend route guards are not a control. Prefer backend evidence (HTTP status) over UI hiding.

Also use built-in `/review-security` on changed diffs after this skill’s runtime checks.

## When to use

- Milestone 12, production-readiness, after auth/payment/upload changes
- User invokes `/security-audit`

## Prerequisites

- Backend running
- Do not paste secrets into reports
- Optional: unauthenticated browser to `/admin`

## Workflow

1. Read `.cursor/rules/security.mdc` and `docs/SECURITY-AUDIT.md`.
2. Run `npm run verify:security` from `backend/`.
3. Execute attack scenarios below against local API (safe lab only).
4. Confirm Host/Origin allowlists in `site-origins.ts` / `main.ts`.
5. Fix CRITICAL and HIGH. Retest. Update `docs/SECURITY-AUDIT.md` and KNOWN-ISSUES.

## Commands

```bash
cd backend
npm run verify:security
curl -s -o NUL -w "%{http_code}" http://localhost:3001/api/admin/bookings
curl -s -o NUL -w "%{http_code}" http://localhost:5173/admin
```

Unauthenticated `/api/admin/*` must be 401 (or 403), never 200 with data.

## Test scenarios

Authentication, authorization, RBAC, JWT expiry, token versioning, inactive users, role changes, password changes, login brute force, rate limiting, CSRF where relevant, XSS, SQL injection (Prisma), path traversal, file upload, SVG, MIME, file size, API authorization, IDOR, admin exposure, PII, mass assignment, parameter tampering, price/booking/payment manipulation, webhook spoof/replay, race/hold flooding, security headers, CORS, Host header, DNS rebinding, open redirects, return URL manipulation, env leakage, production mock payments, error/logging leakage.

Admin `/admin` must not be advertised on the public site.

Price: client `price=1` must not change charge.

## Expected results

Attacks fail safely (401/403/400/404). No admin JSON without JWT. Deactivated users and `tokenVersion` mismatch rejected. Mock payments impossible in production.

## Failure conditions

- Unauthenticated admin API 200
- JWT role trusted after DB role change
- Webhook without valid signature confirms payment
- SVG stored XSS on same origin as admin JWT
- Host header used for reset/payment URLs

## Remediation

Defense in depth: Nest guards + RBAC + tokenVersion + rate limit + trusted origins. Do not “fix” with robots.txt or hidden links.

## Reporting format

Classify CRITICAL / HIGH / MEDIUM / LOW / PASS with evidence (status code, file, line). No secret values.
