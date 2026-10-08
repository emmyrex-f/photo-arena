# Human input required (production)

Fill these on the VPS before the API will stay healthy with `NODE_ENV=production`.
Do not put live values in git.

| Item | Why | Owner |
|---|---|---|
| `BACHS_API_KEY` (live) | Production boot refuses missing Bachs key; `PAYMENTS_MOCK` is forbidden | Client / ops |
| `BACHS_WEBHOOK_SECRET` | Signed webhooks | Client / ops |
| Bachs webhook URL | Register `https://photoarenang.com/api/payments/webhook/bachs` | Client / ops |
| `RESEND_API_KEY` or SMTP | Production requires email delivery | Client / ops |
| DNS A/AAAA for `photoarenang.com` (+ www) → VPS | HTTPS and CORS origins | Client / DNS |
| TLS certificates (Let's Encrypt / Cloudflare) | HTTPS; `PUBLIC_SITE_ORIGINS` is https-only | Ops |
| Optional Cloudflare R2 | Only if switching `STORAGE_PROVIDER` away from `local` | Ops |

Until Bachs + email keys are set, Compose files and images can be ready, but the `api` container will exit on boot by design.
