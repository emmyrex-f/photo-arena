# Human input required

Development continues with safe defaults. These items cannot be invented.

| Information | Why | Where used | Can continue without? |
|---|---|---|---|
| Official TikTok URL | Must not fabricate social links | `social.tiktok` / footer | Yes — icon stays disabled |
| Bachs live API key (`sk_live_…`) | Real charges | `BACHS_API_KEY` | Yes — sandbox/mock in non-prod |
| Bachs live webhook secret | Webhook HMAC in production | `BACHS_WEBHOOK_SECRET` | Yes for local |
| Production SMTP (prefer `bookings@photoarenang.com`) | Confirmation + 24h/2h reminders | `SMTP_*` | Yes — dry-run logs |
| Cloudflare R2 credentials | Production media | `S3_*` / R2 | Yes — local disk in dev |
| Domain/DNS + VPS access | HTTPS, Nginx, go-live | deploy | Yes — local 5173/3001 |
| Confirm Hostinger plan cannot run this stack | Avoid wrong hosting | `docs` / deploy | Yes |
| Client-approved final prices | Catalog still provisional in seed | packages | Yes — `isProvisional` |
| GA4 / Meta Pixel IDs | Optional analytics | admin Content | Yes — loaders no-op when empty |
| `temp-audit-imgs` folder location | Image migration | portfolio/gallery | Yes — existing `public/gallery` |

Do not place these values in git, skills, or MCP config.
