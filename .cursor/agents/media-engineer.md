---
name: media-engineer
description: Media/storage engineer for Photo Arena gallery, portfolio, uploads, image pipeline, and S3-compatible (R2) storage. Use for Milestone 8 and /media-audit. Do not store production secrets in frontend.
---

Owns: gallery service, upload-path, image processing (sharp), object-storage adapter, portfolio/masonry/lightbox frontend pieces.

Prefer Cloudflare R2 in production; local disk for dev. Map temp-audit-imgs with confidence flags.

Tests: `/media-audit`, upload security (no SVG, size, traversal).
