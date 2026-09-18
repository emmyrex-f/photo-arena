# ASSET MIGRATION REPORT

**Status:** Audit only. No asset files were swapped. Waiting for approval before any extract or restore.

**Revision:** 3 (critic passes 1–2 applied)

**Sources**
- Old: `photo arena old/index_27.html` (single-file site; no sibling image/video folders)
- New: `photo arena new/frontend/`
- Disk search: **zero** `.mp4`, `.webm`, or `.mov` files in the workspace

**Image-count census (old HTML)**
- Naive string matches for `<img`: **62** (3 are comments: two audit notes plus one JS comment; not live elements)
- Live `<img>` elements: **59** (old audit in the same file). Of those, **58** have image data and **1** is empty `#lbImg` (`src=""`, lightbox target)
- Attributed live payloads: nav logo + footer logo + 4 home packages + 6 services + 1 about + 22 portfolio + 23 bookings = **58**

`extract-gallery.mjs` only matches `.portfolio-item[data-category]`. It never considered home packages, services cards, about, or `#page-bookings`.

---

### 1. Videos found

| Filename / URL | Old location | New location | Preserved? | Recommended action |
|---|---|---|---|---|
| `LANDSCAPE.mp4` | Home `#hero` `<video id="hero-video">` | `HeroSection.tsx` | **No.** New uses a static photograph. File is **not on disk**. Old site already 404s this path. | Restore the **video** only when the owner supplies `LANDSCAPE.mp4`. Implement `muted` `loop` `playsInline` `preload="metadata"`, a pause control, and `prefers-reduced-motion`. Until then keep a studio still. Do not invent footage. Do not import Unsplash. |
| `photoarena_tour.mp4` | Home `.tour-section` `.tour-video-wrap` (`controls` `playsinline` `preload="metadata"` `poster=""`) | **No section** | **No.** File is **not on disk**. | Restore a player when the file exists. Destination page is **uncertain** (old is Home; About is only a guess). Do not invent a tour clip. |
| `hero-poster.jpg` | Audit **comment** only (`index_27.html` ~1452). Never a real `src`. Tour `poster=""`. | None | Not a shipped asset | Do not list as a missing file. If a hero video arrives, derive a poster from that file or a supplied still. |

**Old hero video behavior (do not copy blindly)**
- `autoplay muted loop playsinline preload="auto"` `aria-hidden="true"`
- No pause control, no `prefers-reduced-motion`, no captions
- CSS fallback: Unsplash stock camera `https://images.unsplash.com/photo-1516035069371-29a1b244cc32?...`

**New hero behavior**
- Static `<img>` from the **first `featured` record** in `portfolio.generated.ts` (currently `/gallery/01-birthdays.jpg` because extract sets `featured: index < 8`). This path is derived, not hardcoded.
- `color-mix` overlay so the photograph remains visible

---

### 2. Images found

#### A. Migrated (byte-match to old portfolio)

22 JPEGs from `#page-portfolio` `.portfolio-item` → `frontend/public/gallery/`.

| Old `data-category` | New path | New component | Action |
|---|---|---|---|
| birthdays ×5 | `01`–`05-birthdays.jpg` | `PortfolioGrid`, `PortfolioPage`, lightbox | **Keep.** Same bytes as old gallery. |
| portraits ×4 | `06`–`09-portraits.jpg` | same | **Keep.** |
| corporate ×5 | `10`–`14-corporate.jpg` | same | **Keep.** |
| kids ×8 | `15`–`22-kids.jpg` | same | **Keep.** |

Home preview uses `featured` (first 8 in HTML order = **5 birthdays + 3 portraits**). Corporate and kids are not in the preview. That subset is **new**; the old home did not show an 8-image gallery strip. Do not call the preview “the old gallery set.”

**Confirmed same-frame:** home “Bundle of Joy Shoots” JPEG === `22-kids.jpg` (and portfolio kids item). No other home-package, service-card, About, or bookings JPEG matches the 22 gallery hashes.

#### B. Old photos not extracted (still base64 in `index_27.html`)

**Home package cards** (`#page-home` `.pkg-card`) → map to `services[]` / `ServicesPreviewSection`, **not** to `bookablePackages` / `ServicesPage` tables.

| Old card | New target | Current new asset | Action (after approval) |
|---|---|---|---|
| Personal / Birthday / Corporate | `services` id `personal-birthday-corporate` | Text only | Extract JPEG onto that preview card. |
| Bundle of Joy Shoots | `services` id `bundle-of-joy` | Text only | Same photograph as `22-kids.jpg`. Reuse that file or extract again. |
| Pre-Wedding Photoshoots | `services` id `pre-wedding` | Text only | Extract JPEG. Not a gallery duplicate. |
| Space Rental | `services` id `space-rental` (“Studio Space Rental”) | Text only | Extract JPEG onto the **existing** preview card. New IA already lists this service. `bookablePackages` / `ServicesPage` tables still omit rental. |

**Services session cards** (`#page-services` `.service-card`) → `ServicesPage` `serviceCategories` only. **Not** `ServicesPreviewSection`.

| Old card | New target | Action |
|---|---|---|
| Birthday Photography | `serviceCategories` birthday | Extract JPEG onto Services page card. |
| Children Photography | children | Extract. |
| Pre-Wedding Photos | pre-wedding | Extract. |
| Professional Indoor Portraits | portraits | Extract. |
| Passport / Visa Photos | passport | Extract. |
| Corporate Headshots | corporate | Extract. |

None of these six match gallery hashes.

**About** (`#page-about` ~1943) → `AboutPage.tsx` currently has no photograph. Unique hash. Extract onto About after approval.

**Bookings page** (`#page-bookings`) — **23 JPEGs, 19 unique hashes.** New `BookPage.tsx` has no `<img>`.

| Old group | Count | Notes | New target | Action |
|---|---|---|---|---|
| `.bk-slide` studio slider | 3 | Larger files than gallery extracts | No slider on `BookPage` | Extract for archive / optional book hero. Destination layout uncertain (do not invent a slider). |
| Booking package cards (`.bk-card-title`) | 8 | Exact titles: Personal / Birthday Shoots; Pre-Wedding / Couples; Family Shoots; Corporate Headshots; Maternity Shoots; Bundle of Joy · 0–1 Year; Bundle of Joy · 2–6 Years; Teens Shoot · 7–15 Years. First four match `bookablePackages` names exactly. The last four have **no** new package row. | Extract. Use those exact titles as keys. Attach only the first four to existing ids. Do not invent Maternity / Bundle / Teens packages. |
| Premium Themed Sets (`.bk-card` / `.bk-card-title`) | 4 | The Curated Wall; The Curated Cove; The Arched Retreat; Aurora Wave | No sets page | Extract for archive. A `.bk-card`-only pass also gets the 8 packages above. |
| Hire a Booth or Backdrop (`.bk-booth-card` / `.bk-booth-title`) | 8 images, 8 hashes | Swing Attitude; Odogwu Vibes; Let's Party Booth; Telephone Booth; plus Wall / Cove / Arched / Aurora again (those four hashes duplicate the themed-set cards). Unique-to-booths: the first four. | No booths page | Extract the four booth-only JPEGs separately. A `.bk-card`-only extract **misses** these. Do not invent a booths page. |

#### C. Remote / third-party

| Asset | Old | New | Action |
|---|---|---|---|
| Unsplash `photo-1516035069371-29a1b244cc32` | Hero CSS fallback | Not used | **Do not download.** Not Photo Arena-owned. |
| Google Fonts | Playfair `600,700,900` + italic `700`; Inter `300–700` | Playfair `500,600,700` + italic `500`; Inter `400,500,600` | Same **family names**, different **weight set**. Not a complete match. |
| OpenStreetMap embed | Not in old site | `ContactPage` `site.mapEmbed` | New-only. Not an old-asset miss. |

---

### 3. Logos / icons

| Original | New implementation | Status |
|---|---|---|
| Nav + footer **custom 320×320 PNG** wordmark (aperture as the O in PHOTO). Identical bytes in both places. Never extracted. | `public/logo.svg` = Arial Black redraw (floating aperture, extra geometric line, `BY NUFX MEDIA` as text). Byte-identical to `photo-arena-logo.svg`. Navbar also shows the text “Photo Arena” beside the SVG. Old nav was **image only**. Footer new = text only. | **Not the migrated original.** Do not KEEP as equivalent. After approval, extract the inlined PNG as `logo.png`. Treat SVG as a separate project file. |
| Favicon + apple-touch **64×64 PNG** (same file, crop of the custom wordmark). Third distinct logo asset. | `/logo.svg` | **Wrong asset.** Extract the 64×64 PNG if a pixel-faithful favicon is required. |
| Emoji icons | Lucide | Intentional accessibility upgrade. Do not migrate emoji. |
| Testimonial letter avatars | Testimonials hidden | Correct per confirmed rule. |
| CSS grain SVG (`.grain` on hero, home packages, FAQ) | Not ported | Decorative. Do not restore unless asked. |

---

### 4. Missing assets

Files the old markup **actually requests** that are not on disk:

1. `LANDSCAPE.mp4`
2. `photoarena_tour.mp4`

`hero-poster.jpg` is **not** a missing shipped file (comment only).

High-resolution camera originals for gallery / bookings / services photos are also absent; only inlined JPEGs exist.

---

### 5. Mismatches

| Place | OLD | NEW | ACTION |
|---|---|---|---|
| Hero | `<video>` `LANDSCAPE.mp4` + Unsplash CSS fallback | Derived still (currently `01-birthdays.jpg`) | Restore video **when the file exists**. Still is not the finished hero. |
| Home tour | `<video>` `photoarena_tour.mp4` + controls | Section omitted | Restore player when file exists. Page destination uncertain. |
| Home packages | 4 JPEG photos | `ServicesPreviewSection` text only | Extract 4 JPEGs onto `services[]` cards (Space Rental already exists there). |
| Services page | 6 JPEG photos | `ServicesPage` text cards | Extract 6 JPEGs onto session-type cards. |
| About | Photograph | No photo | Extract About JPEG. |
| Bookings | Slider + 8 package photos + set photos | `BookPage` form, no images | Extract after approval. Attach only to existing package ids. |
| Logo / favicon | Custom PNGs | Redrawn SVG | Extract old PNGs; do not call SVG the original. |
| Home gallery preview | Did not exist as an 8-up | New birthdays-heavy subset | Not a wrong photo; do not claim it matches old home. |

---

### 6. Uncertain mappings

- Tour video destination page (Home vs About).
- Whether bookings slider photos should become a Book hero (no old-equivalent layout in new IA).
- Whether `logo.svg` should remain as a parallel lockup after the PNG is extracted.
- Whether home preview `featured` flags should stay “first 8” or be re-curated later (out of scope unless asked).

**Confirmed, not uncertain**
- Gallery 01–22 = old portfolio JPEGs.
- Bundle of Joy home card = `22-kids.jpg`.
- About + other 3 home packages + all 6 service cards + bookings JPEGs are **not** gallery duplicates (except the Bundle match).
- Space Rental already has a new preview row.
- Bookings set titles are: The Curated Wall, The Curated Cove, The Arched Retreat, Aurora Wave.
- Bookings booth titles are: Swing Attitude, Odogwu Vibes, Let's Party Booth, Telephone Booth.

**Do not replace uncertain items without a confirmed same-frame match or the owner file.**

---

## Mapping summary

```
Hero video          → #hero-video              → LANDSCAPE.mp4 MISSING
                    → HeroSection (derived still, now 01-birthdays.jpg)
                    → WAIT FOR FILE

Tour video          → Home .tour-video-wrap    → photoarena_tour.mp4 MISSING
                    → no new section           → WAIT FOR FILE; dest uncertain

Portfolio 01–22     → #page-portfolio          → public/gallery/*.jpg
                    → PortfolioGrid            → KEEP

Home pkg cards ×4   → #page-home .pkg-card     → still in old HTML
                    → ServicesPreview services[] → EXTRACT AFTER APPROVAL
                    → Bundle of Joy = 22-kids.jpg

Service cards ×6    → #page-services           → still in old HTML
                    → ServicesPage categories  → EXTRACT AFTER APPROVAL

About photo         → #page-about              → still in old HTML
                    → AboutPage                → EXTRACT AFTER APPROVAL

Bookings 23 imgs    → #page-bookings
                    → 3 slider + 8 .bk-card packages + 4 themed sets + 8 .bk-booth-card
                    → BookPage has none        → EXTRACT AFTER APPROVAL
                    → booth extract is a separate selector

Logo 320 PNG        → nav + footer             → not extracted
                    → /logo.svg redraw         → EXTRACT PNG; SVG is separate

Favicon 64 PNG      → link rel=icon            → not extracted
                    → /logo.svg                → EXTRACT PNG
```

---

## What will not be done without approval

- No video placeholders, stock footage, or generated clips
- No Unsplash download
- No swapping gallery images for “nicer” ones
- No inventing rental/sets/maternity/teens pages
- No redesign of layout or architecture
