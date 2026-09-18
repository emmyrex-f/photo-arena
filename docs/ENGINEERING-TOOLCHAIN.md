# Photo Arena — Engineering Toolchain

**Date:** 2026-09-15  
**Scope:** Cursor capabilities, Marketplace plugins, MCP, skills, subagents.  
**Rule:** Do not claim a tool is installed unless it is discoverable in this session.

---

## Discovery method

- Inspected this session’s tool catalog (`cursor`, `cursor-ide-browser`).
- Read official docs: [Plugins](https://cursor.com/docs/plugins), [Skills](https://cursor.com/docs/skills), [Marketplace](https://cursor.com/marketplace), [MCP](https://cursor.com/docs/mcp).
- Used Cursor Guide for install mechanics and official plugin inventory.
- Compared candidates against this stack: React/Vite, NestJS, Prisma/PostgreSQL, Bachs, VPS/Nginx.

**Install constraint:** Marketplace plugins cannot be installed silently by an agent. Install requires Customize → Install, `/add-plugin`, interactive CLI `/plugin`, or a team admin policy (Default On / Required).

---

## Native capabilities (already available — use these)

| Tool | Type | Source | Status | Purpose | Why selected | Security | Project usage |
|---|---|---|---|---|---|---|---|
| Agent tools (Read/Grep/Shell/Write) | Built-in | Cursor | **Installed / in-session** | Code, tests, docs | Core implementation | Workspace-scoped | All milestones |
| cursor-ide-browser | MCP (Cursor-owned) | Cursor | **Installed / in-session** | Visual, responsive, booking/admin UX | Official browser automation; no extra plugin | Browser tab only; no CDP Input | `/responsive-qa`, `/admin-qa`, `/ui-ux-audit`, booking UX |
| `/review-bugbot` | Built-in skill + subagent | Cursor | **Available** | Bug/regression review | Official; do not duplicate | Reads diffs; no extra secrets | After booking/payment/auth changes |
| `/review-security` | Built-in skill + subagent | Cursor | **Available** | Security review | Official OWASP-oriented review | Same | Milestone 12 and after auth/payment edits |
| `/review` | Built-in skill | Cursor | **Available** | Routes to Bugbot or Security Review | Avoids a custom review plugin | Same | Code review gates |
| `/create-skill` `/create-subagent` `/create-rule` | Built-in skills | Cursor | **Available** | Project skill/agent/rule authoring | Official format | N/A | Tooling phase |
| Project rules | `.cursor/rules/*.mdc` | This repo | **Installed** | Architecture, booking, payments, security | Domain law | No secrets | Always-on |
| Prisma CLI | npm `prisma` | Project `backend/` | **Installed in repo** | Schema, migrate, seed | Already a dependency | Uses `DATABASE_URL` locally | `/database-review` |
| Backend verify scripts | `backend/scripts/verify-*.ts` | This repo | **Installed in repo** | Booking, payment, security runtime checks | Project-specific; no extra SaaS | Talks to local API | `/booking-qa` `/payment-qa` `/security-audit` |

---

## Project skills created (this session)

Location: `.cursor/skills/<name>/SKILL.md`

| Skill | Type | Source | Status |
|---|---|---|---|
| `/booking-qa` | Project skill | This repo | **Created** |
| `/payment-qa` | Project skill | This repo | **Created** |
| `/security-audit` | Project skill | This repo | **Created** |
| `/deployment-check` | Project skill | This repo | **Created** |
| `/database-review` | Project skill | This repo | **Created** |
| `/code-review` | Project skill | This repo | **Created** |
| `/responsive-qa` | Project skill | This repo | **Created** |
| `/ui-ux-audit` | Project skill | This repo | **Created** |
| `/accessibility-audit` | Project skill | This repo | **Created** |
| `/media-audit` | Project skill | This repo | **Created** |
| `/admin-qa` | Project skill | This repo | **Created** |
| `/calendar-qa` | Project skill | This repo | **Created** |
| `/production-readiness` | Project skill | This repo | **Created** |

These are versioned with the repo. Invoke with `/skill-name` or by asking the agent to run the skill.

---

## Project subagents created (this session)

Location: `.cursor/agents/<name>.md`

system-auditor, frontend-uiux, booking-engineer, payment-engineer, backend-engineer, database-engineer, security-engineer, admin-engineer, media-engineer, qa-engineer, responsive-qa, deployment-engineer, final-reviewer.

Ownership boundaries are in each file. Database schema and payment/booking domain changes stay coordinated by the parent agent.

---

## Marketplace plugins — recommended, not silently installed

These are official/verified. **Installation status: NOT INSTALLED in this session** (user action required).

| Tool | Type | Source | Why it would help | Why not auto-installed | Alternative in use |
|---|---|---|---|---|---|
| Cursor Team Kit | Official plugin | [Marketplace](https://cursor.com/marketplace/cursor/cursor-team-kit) | CI watch, PR review, `verify-this`, smoke tests | Agent cannot complete Marketplace Install | Project `/code-review` + verify scripts |
| Prisma | Official/partner plugin | Cursor Marketplace | Prisma MCP + migration skills | Needs user Install; CLI already in repo | `npx prisma` in `backend/` |
| Playwright | Official Cursor plugin | Marketplace | Extra E2E MCP | Duplicates built-in browser; extra Node MCP | cursor-ide-browser |
| GitHub | Official, verified | Marketplace | Issues/PRs/Actions | Needs PAT; extra network/credentials | `gh` CLI if/when a remote exists |

**How you install (when you want them):** Customize → find plugin → Install (project scope), or type `/add-plugin cursor-team-kit` and confirm.

---

## Intentionally NOT installed

| Candidate | Reason rejected |
|---|---|
| Stripe plugin | Payments are Bachs, not Stripe |
| MongoDB plugin | Database is PostgreSQL |
| Supabase plugin | Self-hosted Postgres + Prisma, not Supabase |
| Vercel / Railway plugins | Production target is VPS + Nginx, not those PaaS hosts |
| Postman plugin | Needs Postman account; project already has verify scripts |
| Sentry plugin | No DSN/project yet; would pull production error data |
| Composio | Broad third-party OAuth surface; excessive permissions |
| Notion / Granola / Figma | Not required for this rebuild |
| Community MCP from cursor.directory | Not official; skip unless a specific gap appears |
| Local Prisma MCP in `.cursor/mcp.json` | Would duplicate CLI; risk of wiring `DATABASE_URL` into MCP env |

No production secrets (`BACHS_*`, `DATABASE_PASSWORD`, `JWT_SECRET`, SMTP, S3) were placed in plugins, MCP config, skills, or git.

---

## Object storage research (for Milestone 8)

Evaluated 2026 public pricing (not AWS “permanently free”):

| Provider | Free / low-cost | S3 API | Egress | Fit |
|---|---|---|---|---|
| **Cloudflare R2** | 10 GB + 1M Class A + 10M Class B / month, ongoing | Yes | Always free | **Preferred.** Gallery/portfolio size will stay well under 10 GB for a long time. Zero egress for public images. |
| Backblaze B2 | 10 GB ongoing | Yes | Free up to 3× stored (or via Cloudflare) | Cheaper storage at scale; slightly more ops complexity |
| AWS S3 | 5 GB for **12 months only**, then standard + egress | Native | Paid after free allotment | Rejected as default: not a permanent free tier |

**Decision for implementation:** S3-compatible abstraction with **Cloudflare R2** as the documented production target. Local disk remains the development fallback until R2 credentials exist (`docs/HUMAN-INPUT-REQUIRED.md`).

R2 free-tier limits (document in deployment): 10 GB-month storage, 1 million Class A (write/list), 10 million Class B (read), free egress. Overages: storage $0.015/GB-month; Class A $4.50/million; Class B $0.36/million. Source: [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/).

---

## Configuration

| Item | Location |
|---|---|
| Project skills | `.cursor/skills/` |
| Project subagents | `.cursor/agents/` |
| Always-on rules | `.cursor/rules/` |
| MCP | None added. Built-in browser MCP is session-provided. |
| Secrets | `backend/.env` / `frontend/.env` — gitignored; never copied into skills |

---

## Usage during this rebuild

1. Tooling discovery (this document).
2. Project skills + subagents.
3. Parallel audits using explore/security agents + project skills.
4. Implementation with ownership boundaries.
5. Runtime QA via browser MCP + `backend` verify scripts.
6. Security and Bugbot reviews on changed surfaces.
7. `/production-readiness` before handoff.
