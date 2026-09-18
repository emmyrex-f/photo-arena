---
name: media-audit
description: Audits Photo Arena gallery/portfolio assets, mapping from temp-audit-imgs, upload security, and S3-compatible storage. Use for /media-audit, Milestone 8, or image migration.
---

# Media Audit

Do not dump every image onto the site. Map with evidence. Production media must not live only in the app container.

## When to use

- Milestone 8, gallery/portfolio work, `/media-audit`

## Prerequisites

- `temp-audit-imgs` (search repo and parent folders)
- `docs/ASSET-MIGRATION-REPORT.md`
- Admin credentials for upload tests (seed owner — do not print password)

## Workflow

1. Inventory images (png/jpg/jpeg/webp).
2. Map filename, dimensions, old-site placement, service category.
3. Low confidence → flag for review, do not invent category.
4. Verify public portfolio/homepage gallery read from API/DB, not hardcoded arrays.
5. Upload/deactivate/delete/reactivate via admin; confirm public site updates.
6. Check upload pipeline: MIME, magic bytes/sharp, size limits, no SVG XSS, path traversal.
7. Storage: local fallback vs R2 (`S3_*` env names only in docs).

## Expected results

Editorial masonry portfolio, lazy/responsive images, lightbox a11y, admin CRUD, mapping report complete.

## Failure conditions

- Hardcoded gallery in React
- Unmapped dump of all temp images
- SVG/HTML accepted as image
- Secrets in frontend

## Remediation

CMS-driven GalleryImage; object storage adapter; mapping flags.

## Reporting format

Asset table: file → destination → confidence. Storage status. Upload security PASS/FAIL.
