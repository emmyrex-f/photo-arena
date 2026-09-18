---
name: deployment-check
description: Checks Photo Arena production readiness for VPS + Nginx + HTTPS + Node + PostgreSQL. Use for /deployment-check, Milestone 16, or before go-live.
---

# Deployment Check

Do not assume Hostinger shared hosting can run this stack. Verify the actual plan before go-live.

## When to use

- Milestone 16, Docker/Nginx/env changes, user invokes `/deployment-check`

## Prerequisites

- `frontend` and `backend` build locally
- List of production env vars from README (names only)
- No production secrets in git

## Workflow

1. Read README, `docs/ARCHITECTURE.md`, docker-compose, any `deploy/` or nginx samples.
2. `npm run build` in frontend and backend.
3. Confirm env validation: production refuses mock payments and missing Bachs key.
4. Confirm CORS, trusted proxy, PUBLIC_SITE_ORIGINS, Host allowlist.
5. Confirm media: R2 or documented local-disk limitation.
6. Health check `/api/health`.
7. Fill deployment checklist in `docs/IMPLEMENTATION-STATUS.md`.

## Commands

```bash
cd backend && npm run build
cd frontend && npm run build
docker compose config
```

## Verify

Production env vars, database URL, migrations, frontend/backend build, Nginx (`/` static, `/api` Nest, media), HTTPS, domain photoarenang.com, CORS, trusted proxy, host validation, logging, backups, process manager, health, secrets, Bachs live, email, calendar.

Target:

```
Internet → HTTPS → Nginx
  /        React build
  /api     NestJS
  media    R2 public URLs or /uploads via backend (dev only)
```

## Expected results

Builds succeed. Production config fails closed. Secrets not in images. Backup/restore documented.

## Failure conditions

- `PAYMENTS_MOCK` possible in production
- Absolute URLs built from request Host
- Uploads only inside container with no backup
- Missing migration process

## Remediation

Add env validation, nginx sample, backup script, HUMAN-INPUT-REQUIRED for DNS/Bachs/SMTP/R2.

## Reporting format

Checklist PASS/FAIL/BLOCKED per item above. Blockers listed with owner (dev vs client).
