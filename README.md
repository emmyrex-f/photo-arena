# Photo Arena

Port Harcourt studio website, online booking system, and admin portal (CMS + CRM). This directory is the **new** project.

`../photo arena old/` is read-only reference. Do not modify it.

---

## Status

v2 build (2026-09-13): premium public site redesign, cookie consent + legal pages, CMS-driven content, online booking flow (mock / Bachs sandbox), and a full admin portal. Live Bachs charges remain off until the key prefix is verified.

---

## Confirmed rules (short)

- Open daily. Mon–Sat 8AM–6PM. Sunday 12PM–6PM.
- One location, one session at a time.
- 30-minute slots, no buffer, full package duration.
- Same-day online bookings from the next unstarted 30-minute slot (no notice period).
- Online: 15-minute hold, full payment minus 5%, confirm after Bachs.
- Walk-in: OWNER/ADMIN create `PENDING` reservation, pay at studio.
- Non-refundable. Reschedule +15%. Distinct `NO_SHOW`.
- Guest booking only.

See `docs/` for the full record.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind, React Router, Framer Motion, react-helmet-async |
| Admin UI | shadcn/ui-style components (Radix + cva), recharts, sonner — light/dark mode |
| Backend | NestJS 11, TypeScript, Prisma, PostgreSQL, nodemailer, @nestjs/schedule, sharp |
| Payments | Bachs via provider abstraction + mock provider |
| Uploads | Local disk (`backend/uploads/` or Docker volume), served at `/uploads/*` |
| Hosting | VPS + Docker Compose (Postgres + NestJS + Nginx) |

---

## Local development

```bash
# database only (published on localhost:5432)
docker compose -f docker-compose.dev.yml up -d

# backend (http://localhost:3001/api)
cd backend
npm install
npx prisma db push
npx prisma generate
npm run prisma:seed
npm run start:dev
```

```bash
# frontend (http://localhost:5173 — proxies /api and /uploads to the backend)
cd frontend
npm install
npm run dev
```

Admin portal: http://localhost:5173/admin — sign in with the seeded owner (`SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` from `backend/.env`).

### Environment (backend)

| Variable | Purpose |
|---|---|
| `PAYMENTS_MOCK` | `true` enables mock checkout **only** when `NODE_ENV` is not `production`. Production refuses to boot if this is on, or if `BACHS_API_KEY` is missing. |
| `TRUST_PROXY` | `true` behind Nginx/Cloudflare so rate limits use `X-Forwarded-For`. Leave false if the API is exposed directly. |
| `PUBLIC_SITE_ORIGINS` | Comma-separated origins allowed as Bachs `returnUrl` / `cancelUrl` (default includes `http://localhost:5173`). |
| `STORAGE_PROVIDER` | `local` (VPS disk volume), `cloudinary`, or `r2`. |

Do not commit `.env` files or Bachs keys.

---

## VPS Docker deploy (`photo_vps` / photoarenang.com)

Target path on the server: `/var/www/photo-arena`.

```bash
# On the VPS (after Docker Engine + Compose plugin are installed):
cd /var/www/photo-arena
cp .env.production.example .env
# Edit .env: strong POSTGRES_PASSWORD, JWT_SECRET (>=32 chars),
# PUBLIC_SITE_ORIGINS, STORAGE_PROVIDER=local, TRUST_PROXY=true,
# live BACHS_API_KEY + webhook secret, and RESEND_API_KEY (or SMTP).

docker compose up -d --build
curl -sS http://127.0.0.1/api/health
```

Stack: `db` (Postgres, no public port) · `api` (NestJS) · `web` (Nginx SPA + proxy `/api` and `/uploads`).

Uploads persist in the Docker volume `photoarena_uploads`. Sample TLS host config: `deploy/nginx/photoarenang.com.conf`. Missing live Bachs/email keys are listed in `deploy/HUMAN-INPUT-REQUIRED.md` — production boot fails closed until they are set.

---

## URLs

| Public | Admin |
|---|---|
| `/` `/about` `/services` `/portfolio` `/book` `/book/confirmation` `/contact` `/faq` `/policies` `/blog` `/blog/:slug` `/privacy` `/cookies` `/terms` | `/admin` dashboard · bookings · customers · enquiries · services · gallery · content · payments · notifications · users · audit · settings |

---

## Documentation

- `docs/API-CONTRACT.md` — binding API interface (backend ↔ public site ↔ admin)
- `docs/REQUIREMENTS-CONFIRMED.md`
- `docs/CLIENT-QUESTIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/BOOKING-FLOW.md`
- `docs/PAYMENT-FLOW.md`
- `docs/DECISIONS.md`
- `docs/PROJECT-AUDIT.md`
