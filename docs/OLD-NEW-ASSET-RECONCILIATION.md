# OLD → NEW ASSET RECONCILIATION REPORT

**Status:** Audit only. No application files were changed. Waiting for approval before any extract, copy, or restore.

**Date:** 15 September 2026

**Old source of truth:** `photo arena old/index_27.html` (single-file site; no sibling image/video folders). Cross-checked against `index_27.audit.html` and `photo arena old/_media_inventory.json`.

**New build:** `photo arena new/frontend/` (React) + `photo arena new/backend/uploads/` (CMS).

This report supersedes `docs/ASSET-MIGRATION-REPORT.md` Rev 3 on videos and logos. That earlier document said zero `.mp4` files existed on disk. They now do — with a critical identity problem on the tour file.

---

## Method

Inspected the old HTML/CSS/JS for `<img>`, `<video>`, `<source>`, `poster`, CSS `background-image` / `url(...)`, JavaScript media refs, file extensions, and CDN URLs. Counted live payloads separately from audit comments.

Old live census:

- `<img>` string matches: 62 (3 are comments / empty lightbox target `#lbImg`)
- Live image payloads: **58** (52 unique base64 bodies; 6 duplicate hashes)
- `<video>`: **2** (`LANDSCAPE.mp4`, `photoarena_tour.mp4`)
- Remote CSS background: Unsplash camera still
- Decorative CSS grain: inline SVG noise
- Favicon + apple-touch: same 64×64 PNG, inlined twice
- No `.webm`, `.mov`, `.avif`, or GIFs
- `hero-poster.jpg` appears only in an audit **comment**, never as a real `src`

---

## Old-site media inventory

| Old location | Asset | Type | Local/Remote | Behavior | New equivalent |
| ------------ | ----- | ---- | ------------ | -------- | -------------- |
| `#hero` `#hero-video` | `LANDSCAPE.mp4` | video/mp4 | Local (referenced; **now present** in new `public/`) | Autoplay, muted, loop, `playsinline`, `preload="auto"`, `aria-hidden`, no pause, no reduced-motion | `HeroSection.tsx` → `/LANDSCAPE.mp4` + still `/gallery/01-birthdays.jpg` |
| `#hero::before` | Unsplash `photo-1516035069371-29a1b244cc32` | JPEG (CDN) | Remote | CSS fallback when video 404s | Not used (correct — not Photo Arena media) |
| Home `.tour-video-wrap` | `photoarena_tour.mp4` | video/mp4 | Local (referenced; **file still absent**) | Native `controls`, `playsinline`, `preload="metadata"`, empty `poster` | `StudioTourSection.tsx` → `/tour.mp4` (**wrong file**; see below) |
| Nav `.nav-logo-img` | Inlined PNG wordmark (~17 KB decoded) | PNG | Embedded | Image-only lockup | `Navbar.tsx` → `/logo.png` (same design, higher-res crop) |
| Footer `.footer-logo-img` | Same PNG as nav (duplicate hash) | PNG | Embedded | Image-only lockup | `Footer.tsx` → `/logo.png` |
| Head favicon / apple-touch | 64×64 PNG crop of wordmark | PNG | Embedded | Tab icon | `index.html` → `/logo.svg` (redraw, not original) |
| Home `.pkg-card` ×4 | Personal/Birthday/Corporate; Bundle of Joy; Pre-Wedding; Space Rental | JPEG | Embedded | Card photos, hover zoom | `ServicesPreviewSection.tsx` — **text only** |
| Home `.pkg-card` Bundle of Joy | Same bytes as portfolio `22-kids.jpg` | JPEG | Embedded | Card photo | Still unused on home cards |
| About `.about-photo-panel` | “Inside the Photo Arena studio space” | JPEG | Embedded | Large studio photo | `AboutPage.tsx` — **no photo**. File sits unused in `tmp-audit-imgs/about.jpg` |
| Services `.service-card` ×6 | Birthday; Children; Pre-Wedding; Indoor Portraits; Passport/Visa; Corporate | JPEG | Embedded | Card photos | `ServicesPage.tsx` — **tables, no photos** |
| Portfolio `.portfolio-item` ×22 | 5 birthdays, 4 portraits, 5 corporate, 8 kids | JPEG | Embedded | Masonry + lightbox; captions in `.pi-title` | `public/gallery/01–22-*.jpg` → `PortfolioPage` / `PortfolioGrid` |
| Bookings `.bk-slide` ×3 | “Photo Arena Studio” slider | JPEG | Embedded | Crossfade hero slider | `BookPage.tsx` — **no images** |
| Bookings `.bk-card` packages ×8 | Personal/Birthday; Pre-Wedding; Family; Corporate; Maternity; Bundle 0–1; Bundle 2–6; Teens 7–15 | JPEG | Embedded | Package card photos | `BookPage.tsx` — **no images** |
| Bookings themed sets ×4 | Curated Wall; Curated Cove; Arched Retreat; Aurora Wave | JPEG | Embedded | Set cards | Extracted to `tmp-audit-imgs/set-*.jpg`, **not wired** |
| Bookings booths ×4 unique | Swing Attitude; Odogwu Vibes; Let's Party; Telephone Booth | JPEG | Embedded | Booth cards | Extracted to `tmp-audit-imgs/booth-*.jpg`, **not wired** |
| Bookings backdrop hire ×4 | Same four set photos reused | JPEG | Embedded | Duplicate of set cards | Same `tmp-audit-imgs` files, **not wired** |
| Testimonials `.testimonial-avatar` | Letter initials (C, etc.) | Text, not media | n/a | Decorative initials | `TestimonialsSection.tsx` — quotes only; section hidden unless API publishes |
| `.grain::after` | Inline SVG noise | SVG | Embedded | Texture on hero / packages / FAQ | Not ported |
| Google Fonts | Playfair + Inter | Font | Remote | Display + body | Same families, different weights |
| Instagram / home 8-up gallery | Did not exist | — | — | — | New `InstagramStrip` + `PortfolioPreviewSection` (gallery reuse) |

**Confirmed duplicate identities in the old HTML**

- Nav logo === footer logo
- Bundle of Joy home card === portfolio item 22 (`22-kids.jpg`)
- Four themed-set photos === four backdrop-hire booth photos
- Favicon === apple-touch-icon

No other home-package, service-card, About, or bookings JPEG matches the 22 gallery hashes except the Bundle/kids match above.

---

## Video identity (critical)

These three files are **byte-identical** (SHA-256 `41A7B3A2…DA683F`, 7,845,341 bytes each):

- `frontend/public/LANDSCAPE.mp4`
- `frontend/public/tour.mp4`
- `photo arena new/video_mp4.mp4`

`photoarena_tour.mp4` does **not** exist anywhere in the workspace. A full disk search found no `.webm` or `.mov`.

So: the hero video file is present. The tour path is a **copy of the hero video**, not the original studio-tour clip.

---

## STEP 4 — `/portfolio`

OLD: 22 inlined JPEGs, HTML order, categories birthdays → portraits → corporate → kids, masonry + lightbox, overlay titles (e.g. “Cake & Candles Moment”).

NEW: `extract-gallery.mjs` wrote those exact 22 bodies to `frontend/public/gallery/01-birthdays.jpg` … `22-kids.jpg`. `portfolio.generated.ts` and seed `pa-01`…`pa-22` preserve that order and those four categories. `PortfolioGrid` uses masonry + lightbox. Filters match the old categories.

**Asset identity of the 22 files: MATCHED.**

Caveats (not identity swaps):

- Overlay titles were not migrated; alts are generic category strings.
- `PortfolioPage` prefers `GET /public/gallery`. If the API returns a non-empty list, that list **replaces** the static 22. Seed points at `/gallery/*.jpg`. Separately, `backend/uploads/gallery/` contains **seven ~54-byte WebP pairs** — not real photographs. If those rows are active in the database they would pollute `/portfolio`.
- Featured flags are “first 8 in HTML order” (5 birthdays + 3 portraits). That only affects the **new** home preview, not the full portfolio set.

Do not replace these 22 from filename similarity with CMS uploads. The old inlined JPEGs are the source of truth until camera originals are supplied.

---

## STEP 5 — `/` (homepage)

| Section | Old media | New media | Verdict |
| --- | --- | --- | --- |
| Hero | Background **video** `LANDSCAPE.mp4`; Unsplash CSS fallback | Always paints `01-birthdays.jpg`; overlays `/LANDSCAPE.mp4` if HEAD returns `video/*`. Pause control + `prefers-reduced-motion` + `muted` `playsInline` `preload="metadata"` | Video **wired and file present**. Poster/fallback is the **wrong still**. See MISMATCHED. |
| Home packages | 4 photographs | Text-only 2×2 | MISMATCHED |
| Studio tour | Distinct **video** `photoarena_tour.mp4` with native controls | Player for `/tour.mp4` (same bytes as hero) or “coming soon” | MISMATCHED / MISSING original |
| Gallery 8-up | Did not exist | New editorial grid from featured gallery | New surface, not an old miss |
| Instagram strip | Did not exist | Six tiles from settings or gallery | New surface |
| About photo | On old About page, not home | Still missing on `/about` | See About |
| Logos | Inlined PNG | `/logo.png` / `/logo-on-light.png` (same wordmark) | MATCHED (public chrome) |
| Testimonials | Letter avatars, not photos | Text quotes when published | No photo miss |

---

# Categories

### MATCHED

Original asset correctly mapped.

1. **Portfolio 01–22** — old `#page-portfolio` JPEGs → `public/gallery/01–22-*.jpg` → `PortfolioGrid` / fallback gallery. Same order, same four categories, masonry restored.
2. **Public wordmark** — old nav/footer PNG design → `Navbar` `/logo.png` (over dark hero) and `/logo-on-light.png` (solid header). Same aperture-as-O lockup and “BY NUFX MEDIA”. Exact old padded square also exists as `tmp-audit-imgs/logo-nav.png` (~17 KB) but is unused.
3. **Hero video file presence + player intent** — `LANDSCAPE.mp4` is on disk and `HeroSection` / `site.hero.videoUrl` / seed `hero.videoUrl` point at it. Implementation adds pause, reduced-motion skip, muted autoplay, `playsInline` — that accessibility upgrade is correct and should be kept.
4. **Unsplash fallback omitted** — old CSS used a stock camera still when the video 404d. New build does not load it. Correct: not Photo Arena media.
5. **Testimonial “photos”** — old site used letter initials, not portraits. New quotes-only treatment does not drop a photograph.
6. **Bundle of Joy === `22-kids.jpg`** — identity recorded; file exists in the gallery set even though the home card does not use it.

### MISMATCHED

New build uses a different/wrong asset, a different media type, or omits a photo that still exists.

---

OLD:  
`#hero-video` → `LANDSCAPE.mp4` (background video). CSS Unsplash only if the file 404d.

NEW:  
`HeroSection.tsx` → always `<img src="/gallery/01-birthdays.jpg">`, then optional `<video src="/LANDSCAPE.mp4">`.

PROBLEM:  
**VIDEO + WRONG STILL.** The birthday still is not a frame of the landscape video. It is the first featured portfolio JPEG (`featured: index < 8` in the extract script). If HEAD fails or `prefers-reduced-motion` is on, visitors see a birthday photograph as the hero, not the landscape clip.

RECOMMENDED ACTION:  
Keep the video player and a11y behaviour. Replace the poster/fallback with a still taken from `LANDSCAPE.mp4` (or a supplied `hero-poster` from that clip). Do not keep `01-birthdays.jpg` as the hero identity.

---

OLD:  
`.tour-video-wrap` → `photoarena_tour.mp4` (user-controlled studio tour).

NEW:  
`StudioTourSection.tsx` → `/tour.mp4`.

PROBLEM:  
**WRONG VIDEO.** `tour.mp4` is a byte-for-byte copy of `LANDSCAPE.mp4`. The original tour file is not in the workspace. If HEAD succeeds, the homepage tour plays the hero landscape clip. If HEAD fails, the UI shows “Studio tour video coming soon” — a placeholder, not the original.

RECOMMENDED ACTION:  
Do not treat `tour.mp4` as the original tour. Search owner backups for `photoarena_tour.mp4`. Until it is found, keep the player but do not claim the landscape file is the tour. Report the original as MISSING (below). Do not invent a replacement clip.

---

OLD:  
Home `.pkg-card` ×4 photographs (Personal/Birthday/Corporate; Bundle of Joy; Pre-Wedding; Space Rental).

NEW:  
`ServicesPreviewSection.tsx` — text, prices, no `<img>`.

PROBLEM:  
Photographs exist in the old HTML and are not shown. Bundle of Joy is already on disk as `22-kids.jpg`. The other three are still only inside `index_27.html` (not in `tmp-audit-imgs`).

RECOMMENDED ACTION:  
After approval, extract the three unique JPEGs and reuse `22-kids.jpg` on the existing four preview cards. Do not invent new cards or change booking packages.

---

OLD:  
`#page-services` `.service-card` ×6 photographs.

NEW:  
`ServicesPage.tsx` — duration tables, no card photos.

PROBLEM:  
Six unique JPEGs remain inlined in the old HTML and are not extracted.

RECOMMENDED ACTION:  
After approval, extract onto the existing six session-type headings. Do not add services.

---

OLD:  
`#page-about` photograph “Inside the Photo Arena studio space”.

NEW:  
`AboutPage.tsx` — copy + Lucide icons, no photo. Extract already at `tmp-audit-imgs/about.jpg` (~100 KB).

PROBLEM:  
Asset exists on disk and is unused.

RECOMMENDED ACTION:  
Place `about.jpg` on `AboutPage` without redesigning the layout.

---

OLD:  
`#page-bookings` — 3 slider JPEGs + 8 package JPEGs + 4 set JPEGs + 4 unique booth JPEGs.

NEW:  
`BookPage.tsx` — **no `<img>` at all.** Sets/booths extracted to `tmp-audit-imgs/` but unused. Slider and eight package photos still only in old HTML.

PROBLEM:  
Booking/package imagery from the old site is absent. This is a media gap, not a booking-engine gap.

RECOMMENDED ACTION:  
After approval, attach extracted photos only to existing service/package rows (sets Wall/Cove/Arched/Aurora and booths Swing/Odogwu/Let's Party/Telephone already exist in seed). Do not rebuild the old slider unless asked. Do not invent Maternity/Teens pages if those packages are absent from the new catalogue — archive those four photos rather than creating products.

---

OLD:  
`<link rel="icon">` 64×64 PNG wordmark crop.

NEW:  
`frontend/index.html` → `/logo.svg` (Arial Black redraw: floating aperture, extra geometric line). Admin chrome also uses this SVG.

PROBLEM:  
Favicon is not the original PNG. `tmp-audit-imgs/favicon.png` is the original extract.

RECOMMENDED ACTION:  
Point the public favicon at the extracted PNG. Keep `logo.svg` out of the public wordmark unless you explicitly want the redraw as a separate lockup.

---

OLD:  
Hero is **video**.

NEW:  
Even when the video plays, the DOM still uses a **static gallery JPEG** as the painted base layer.

PROBLEM:  
This is the only **VIDEO → IMAGE** fallback currently shipping. Tour is VIDEO → (wrong video | placeholder), not VIDEO → photograph.

RECOMMENDED ACTION:  
Treat hero fallback as a derived poster from `LANDSCAPE.mp4`, not as a portfolio still.

### MISSING

Original asset exists or is referenced in the old build but cannot currently be found as the correct file.

1. **`photoarena_tour.mp4`** — referenced in old HTML; **not on disk**. `tour.mp4` is not a substitute (identical to `LANDSCAPE.mp4`).
2. **Home package JPEGs ×3 unique** (Personal/Birthday/Corporate; Pre-Wedding; Space Rental) — still only base64 in `index_27.html`. Not in `public/` or `tmp-audit-imgs/`.
3. **Services page JPEGs ×6** — still only in old HTML.
4. **Bookings slider JPEGs ×3** — still only in old HTML.
5. **Bookings package-card JPEGs ×8** — still only in old HTML.
6. **High-resolution camera originals** for all of the above and the gallery — old site only shipped compressed inlines. Documented in `CLIENT-QUESTIONS.md` as `Q-GALLERY-ORIGINALS`.

`hero-poster.jpg` is **not** missing: it was never a shipped file.

### INTENTIONALLY CHANGED

New asset differs but there is a clear, documented reason.

| Change | Reason |
| --- | --- |
| Unsplash hero fallback not used | Third-party stock; not Photo Arena media |
| CSS grain SVG not ported | Decorative only |
| Emoji icons → Lucide | Accessibility; old audit flagged emoji-as-icon |
| Hero pause control, `prefers-reduced-motion`, `preload="metadata"`, muted autoplay | Preserve video intent without copying inaccessible autoplay |
| Tour custom play button vs native `controls` | Same user-started playback intent; avoid inaccessible default chrome |
| Home 8-up gallery + Instagram strip | New IA; not a replacement for an old media set |
| Testimonials hidden until published | Confirmed CMS rule, not a photo migration |
| Public logo cropped/larger than the old 320 padded square | Same wordmark; nav uses a tighter crop (`/logo.png`) and a dark-on-light variant |
| Dark charcoal/champagne palette | Out of scope for this milestone; do not revert |

### UNCERTAIN

Mapping cannot be established confidently.

1. **Whether `LANDSCAPE.mp4` on disk is the original hero clip** — filename and player mapping match, and it is the only distinct video in the repo. There is no old-file hash to compare because the old site never bundled the bytes. Confidence is high on *intent*, not provable byte-lineage from the old folder.
2. **Tour destination** — old tour lived on Home; new `StudioTourSection` is also on Home. About is not a required destination unless you decide otherwise.
3. **Bookings slider** — no equivalent layout on `BookPage`. Photos should be archived or used as a single static book header, not a new carousel, unless you approve a slider.
4. **Maternity / Bundle-of-Joy age bands / Teens booking cards** — old photos exist; corresponding new package rows may not. Do not create products to host photos.
5. **CMS WebP uploads (~54 bytes each)** — seven placeholder files under `backend/uploads/gallery/`. If active in Postgres they would override or mix with the original 22. Live API contents were not mutated for this audit.
6. **`logo.svg` vs PNG** — SVG is a separate redraw (`photo-arena-logo.svg`). Public header already uses PNG. Whether the SVG remains for admin/favicon is a product choice.
7. **Hero HEAD gate** — video only mounts if `Content-Type` starts with `video/`. A misconfigured static host would hide a present file and leave the birthday still. Runtime check, not an asset-identity swap.

---

## VIDEO → IMAGE (explicit list)

| Location | Old | New | Classification |
| --- | --- | --- | --- |
| Homepage hero | `LANDSCAPE.mp4` | Video wired **plus** birthday JPEG fallback | **Partial.** File found. Fallback still is the migration gap. |
| Homepage tour | `photoarena_tour.mp4` | `/tour.mp4` = copy of hero **or** “coming soon” | **Not an image replacement.** Original video **MISSING**; current file is the wrong video. |

No other old section used video.

---

## What will not be done without approval

- No file copies, extracts, or component wiring
- No stock footage, generated clips, or Unsplash download
- No swapping gallery 01–22 for CMS WebPs or “nicer” shots
- No booking, payment, pricing, auth, or palette changes
- No inventing pages to hold unused photos

After approval, the only work in this milestone is the media corrections listed under MISMATCHED / MISSING.
