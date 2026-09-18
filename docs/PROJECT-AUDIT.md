# Photo Arena — Project Audit Report

**Audit Date:** 2026-09-11  
**Audited By:** Senior Technical Lead (AI)  
**Purpose:** Discovery phase for full-stack rebuild  
**Old Project Location:** `../photo arena old/`  
**New Project Location:** `./` (photo arena new)  
**Requirements Update:** 2026-09-12 — owner confirmed hours, capacity, booking/payment rules, notifications, palette, and website IA.

---

## Implementation status (2026-09-12)

Discovery is complete enough to start the public site and backend foundations.

**Confirmed after this audit was first written:**

- Hours, one location, one session, 30-minute slots, no buffer
- Dual booking/payment flows (online Bachs vs studio payment)
- 5% online discount (backend only), non-refundable, 15% reschedule, distinct `NO_SHOW`
- Homepage is a conversion page, not a content dump
- Full gallery lives on Portfolio; Home shows a curated preview
- Design tokens use the new cool slate + champagne palette (old gold/black is retired)
- Hosting is VPS; domain is photoarenang.com

**Still open, but only blocking specific features:** final price list, Bachs key environment prefix, notification recipient addresses, approved testimonials, hero video file.

The sections below remain a record of the old static site. Prefer `REQUIREMENTS-CONFIRMED.md`, `DECISIONS.md`, and `ARCHITECTURE.md` for current build rules.

---

## Executive Summary

The existing Photo Arena website is a **single-file, static HTML/CSS/JavaScript SPA** (3.3MB) with no backend, no database, and no actual booking/payment functionality. It is a marketing-focused landing page that **simulates** a booking flow but does not process real bookings or payments.

**Key Finding:** This is not a patchable system. A complete rebuild is required to add:
- Real booking engine with availability management
- Payment processing integration
- Admin portal for business operations
- Customer database and CRM
- Backend API and database

---

## 1. EXISTING ARCHITECTURE

### 1.1 What Exists Today

| Component | Status | Description |
|-----------|--------|-------------|
| **Frontend** | ✅ EXISTS | Single-page HTML/CSS/JS application |
| **Backend** | ❌ DOES NOT EXIST | No server, no API |
| **Database** | ❌ DOES NOT EXIST | No data persistence |
| **Booking System** | ❌ DOES NOT EXIST | Frontend form only, no actual booking |
| **Payment System** | ❌ DOES NOT EXIST | No payment integration |
| **Admin Portal** | ❌ DOES NOT EXIST | No management interface |
| **Authentication** | ❌ DOES NOT EXIST | No login system |

### 1.2 Technology Stack (Old Project)

- **HTML5** — Single-file SPA with client-side routing
- **CSS3** — Embedded `<style>` block (~1200 lines)
- **Vanilla JavaScript** — Embedded `<script>` blocks (~600 lines)
- **Assets** — 61 base64-encoded data URIs inlined in HTML (3.3MB total)
- **Fonts** — Google Fonts (Playfair Display + Inter)
- **Hosting** — Static file hosting (no server requirements currently)

### 1.3 Current File Structure

```
photo arena old/
├── index_27.html              (3.3MB - main site)
├── index_27.audit.html        (3.3MB - annotated copy)
├── AUDIT_REPORT.md            (UX/accessibility audit from 2026-09-05)
├── PREMIUM_UPGRADE_STATUS.md  (partial redesign notes)
└── .claude/
    ├── launch.json
    └── plugins/
        ├── fullstack-dev-skills/
        └── ui-ux-pro-max-skill/
```

**Critical Note:** No `package.json`, no `node_modules`, no backend code, no database files, no `.env`, no server configuration.

---

## 2. FRONTEND ANALYSIS

### 2.1 Pages/Sections

The SPA contains **6 client-side routes** managed by JavaScript `showPage()` function:

| Page ID | Purpose | Status |
|---------|---------|--------|
| `page-home` | Hero, services overview, highlights, why-us, FAQ | ✅ Complete |
| `page-about` | Studio story, team, values | ✅ Complete |
| `page-services` | Service categories (birthdays, corporate, bundles, pre-wedding, rental) | ✅ Complete |
| `page-portfolio` | Gallery with filters (All, Birthdays, Corporate, Portraits, Kids) | ✅ Complete |
| `page-bookings` | **Fake booking form** (no backend submission) | ⚠️ Frontend only |
| `page-contact` | Contact form, action cards, map placeholder | ⚠️ Form uses Web3Forms |

### 2.2 Key Components & Features

#### Navigation
- Sticky navbar with logo and links
- Hamburger menu for mobile (has accessibility issues per audit)
- Client-side routing via `onclick` handlers (not real links)

#### Hero Section
- Large headline with Playfair Display typography
- Video background (`LANDSCAPE.mp4` - file missing, will 404)
- Gold CTA buttons
- Operating hours badge (8AM–6PM)

#### Services Section
- 4 service cards with pricing:
  1. **Personal / Birthday / Corporate** — From ₦25,000
  2. **Bundle of Joy Shoots** — From ₦45,000
  3. **Pre-Wedding Photoshoots** — From ₦40,000
  4. **Space Rental** — From ₦40,000/hr

#### Packages Section (discovered in bookings page)
- Multiple duration tiers:
  - 30 min: 1 outfit, 3 photos — ₦40,000
  - 60 min: 2 outfits, 8 photos — ₦60,000
  - 90 min: 3 outfits, 12 photos — ₦70,000
  - 120 min: 4 outfits, 15 photos — ₦90,000

#### Portfolio/Gallery
- 59 images (all base64-encoded, ~3MB total)
- Filter buttons (All, Birthdays, Corporate, Portraits, Kids)
- Lightbox modal for full-screen view
- No lazy loading

#### Bookings Page
- **This is a FAKE booking flow**
- Shows packages and pricing
- Has date/time selection UI
- Has customer info form
- **Does not actually create bookings**
- **Does not check real availability**
- **Does not process payments**

#### Contact Form
- Uses **Web3Forms** (third-party service: https://api.web3forms.com/submit)
- Fields: Name, Email, Message
- Basic client-side validation
- Honeypot anti-spam
- **This is the only functional form** (sends email via Web3Forms)

#### FAQ Accordion
- 7 questions with expand/collapse
- Has accessibility issues (no `aria-controls`, panels not hidden properly)

#### Testimonials
- 4 hardcoded testimonials with avatars
- Static content, not database-driven

### 2.3 JavaScript Functionality

**Core functions identified:**

```javascript
showPage(name, pushHistory)     // Client-side routing
updateNavActive(name)           // Active nav styling
toggleMenu()                     // Hamburger menu
closeMenu()                      // Close mobile menu
toggleFaq(btn)                   // FAQ accordion
filterPortfolio(category, btn)   // Gallery filtering
validateContactForm()            // Form validation
openLightbox(el)                 // Gallery lightbox
closeLightbox()                  // Close lightbox
lbNav(dir)                       // Lightbox prev/next
triggerReveal()                  // Scroll animations (IntersectionObserver)
```

**Critical Bug Identified:**
- Line ~3539: `document.getElementById('lightbox').addEventListener(...)` throws `TypeError` because `#lightbox` is declared later in the DOM
- This kills all subsequent script initialization
- Scroll-to-top button, Escape key, and initial reveal animations never bind

### 2.4 CSS Architecture

- **Design System:**
  - Pure black background (`#000000`)
  - Gold accent (`#F8C630`)
  - Playfair Display (headlines) + Inter (body text)
  - 8px spacing scale
  - Refined radius scale (4/8/16/24px)
  
- **Responsive Breakpoints:**
  - 480px, 700px, 768px, 900px, 1024px

- **Known Issues (from audit):**
  - Missing `:focus-visible` styles (accessibility)
  - Emoji used as icons instead of SVGs
  - Some contrast ratio failures
  - Touch targets under 44×44px
  - `prefers-reduced-motion` not fully respected

### 2.5 Assets

**Assets Location:** All inlined as base64 data URIs

- **Logo** — Base64 PNG (~15KB, duplicated 2x in HTML)
- **Images** — 59 gallery photos (base64 JPG/PNG, ~3MB total)
- **Video** — Reference to `LANDSCAPE.mp4` (file does not exist in project)
- **Icons** — Currently emoji (📸 📞 ✉️ 📍 🎂 ⭐ etc.) — need SVG replacement

**Performance Impact:**
- 3.3MB HTML file (uncacheable)
- No image lazy loading
- No `width`/`height` on images (causes layout shift)
- Base64 inflates binary by ~33%

---

## 3. BACKEND ANALYSIS

### 3.1 Server/API

**Status:** ❌ **DOES NOT EXIST**

- No Express, no Nest.js, no API routes
- No `/api/` endpoints
- No server configuration files
- No `server.js`, `app.js`, or similar

### 3.2 Database

**Status:** ❌ **DOES NOT EXIST**

- No PostgreSQL
- No Prisma/Drizzle schema
- No `prisma/` folder
- No `.db` files
- No database configuration
- No migrations
- No seed data

### 3.3 Authentication

**Status:** ❌ **DOES NOT EXIST**

- No login system
- No password hashing
- No JWT/session management
- No protected routes
- No user accounts

### 3.4 Booking System

**Status:** ❌ **DOES NOT EXIST**

The "bookings page" is purely decorative:
- Shows static pricing
- Has date/time pickers (no availability checking)
- Has customer form (no data submission)
- **Does not prevent double booking** (because it doesn't book anything)
- **Does not store bookings**
- **Does not send confirmation emails**

### 3.5 Payment System

**Status:** ❌ **DOES NOT EXIST**

- No Bachs integration
- No Paystack, no Flutterwave, no Stripe
- No payment gateway of any kind
- No checkout flow
- No transaction records
- No webhook handling

---

## 4. BUSINESS DATA EXTRACTED

### 4.1 Contact Information

| Field | Value |
|-------|-------|
| **Phone** | 09059813823 |
| **Email** | photoarenang@gmail.com |
| **Location** | Port Harcourt, Rivers State, Nigeria |
| **Address** | Peter Odili Road (mentioned in copy) |
| **Hours** | 8AM – 6PM (days not specified) |

### 4.2 Services Offered

1. **Personal / Birthday / Corporate Shoots**
   - Starting price: ₦25,000
   - Use case: Individual portraits, birthday parties, professional headshots

2. **Bundle of Joy Shoots**
   - Starting price: ₦45,000
   - Use case: Newborn/baby photography

3. **Pre-Wedding Photoshoots**
   - Starting price: ₦40,000
   - Use case: Engagement/pre-wedding sessions

4. **Space Rental**
   - Starting price: ₦40,000/hr
   - Use case: Studio space rental for external photographers

### 4.3 Packages (from Bookings page)

| Duration | Includes | Price |
|----------|----------|-------|
| 30 min | 1 outfit, 3 photos | ₦40,000 |
| 60 min | 2 outfits, 8 photos | ₦60,000 |
| 90 min | 3 outfits, 12 photos | ₦70,000 |
| 120 min | 4 outfits, 15 photos | ₦90,000 |

**Note:** There appears to be a pricing discrepancy. Services section shows "From ₦25,000" but the packages start at ₦40,000. This needs client clarification.

### 4.4 Gallery Categories

- All
- Birthdays
- Corporate
- Portraits
- Kids

59 photos currently exist in the gallery (all base64-encoded).

### 4.5 Social Links

| Platform | URL |
|----------|-----|
| **Instagram** | https://www.instagram.com/photoarenang |
| **Facebook** | https://www.facebook.com/share/1DKYw3rfJK/ |
| **WhatsApp** | https://api.whatsapp.com/send/?phone=2349059813823 |

---

## 5. MIGRATION MAP

### 5.1 Frontend Components (Old → New React)

| Old Feature | New React Component | Notes |
|-------------|---------------------|-------|
| Navbar + hamburger | `<Navbar />` | Fix accessibility issues |
| Hero section | `<Hero />` | Replace missing video, fix CTA copy |
| Services cards | `<ServiceCard />` × 4 | Connect to database |
| Packages grid | `<PackageCard />` × N | Connect to database |
| Gallery + filters | `<Gallery />` + `<GalleryFilter />` | Extract images to files, add lazy loading |
| Lightbox modal | `<Lightbox />` | Fix focus management |
| FAQ accordion | `<FAQ />` + `<FAQItem />` | Fix ARIA |
| Testimonials | `<Testimonials />` | Make CMS-editable |
| Contact form | `<ContactForm />` | Replace Web3Forms with own backend |
| Booking form | `<BookingFlow />` | **Rebuild entirely with real backend** |
| Footer | `<Footer />` | Standard component |

### 5.2 Assets Migration

| Asset Type | Old | New | Action |
|------------|-----|-----|--------|
| **Logo** | Base64 PNG (15KB × 2) | `/public/logo.png` or SVG | Extract once, reference |
| **Gallery Images** | 59 base64 JPGs (3MB) | `/public/gallery/*.webp` | Extract, convert to WebP, add lazy loading |
| **Video** | Missing `LANDSCAPE.mp4` | `/public/hero-video.mp4` | Source from client OR remove |
| **Icons** | Emoji (📸 📞 ✉️ etc.) | SVG (Lucide/Heroicons) | Replace with accessible SVGs |

### 5.3 Data Migration

**Current:** All hardcoded in HTML  
**New:** Database-driven

| Data Type | Migration Strategy |
|-----------|-------------------|
| **Services** | Seed database with 4 services from HTML |
| **Packages** | Seed database with 4 packages from HTML |
| **Gallery Images** | Seed database with 59 images (extract from base64) |
| **Testimonials** | Seed database with 4 testimonials from HTML |
| **Business Info** | Seed database settings table |
| **FAQ** | Seed database with 7 questions |

---

## 6. RISKS & UNKNOWNS

### 6.1 HIGH-RISK AREAS

#### 1. Booking Engine Complexity ⚠️ **CRITICAL**

**Risk:** Building a booking system that prevents double-booking while allowing walk-ins is complex.

**Unknown Questions:**
- Are walk-ins accepted? *(Mentioned in copy: "Walk-In Friendly")*
- How many customers can be served simultaneously?
- Is there only one studio space, or multiple rooms/sets?
- What is the buffer time between bookings?
- Can customers book same-day?
- What happens when a walk-in arrives during an online booking slot?
- Can admin override online bookings?

**Architectural Implications:**
- Need resource/capacity management
- Need transaction-safe booking creation
- Need conflict detection
- Need manual admin override capability

#### 2. Payment Integration ⚠️ **BLOCKING**

**Risk:** Bachs integration pending approval.

**Unknown Questions:**
- Bachs account status? (Approved? Sandbox credentials available?)
- Full payment required upfront, or deposit system?
- Refund policy?
- Failed payment handling?
- Abandoned checkout recovery?

**Mitigation Strategy:**
- Build payment abstraction layer now
- Use mock/interface until Bachs credentials available
- Do not block other development

#### 3. Operating Hours & Availability ⚠️ **CRITICAL**

**Risk:** Cannot build booking calendar without knowing actual schedule.

**Unknown Questions:**
- Open 7 days/week or specific days?
- 8AM–6PM confirmed for all days?
- Holidays/closed dates?
- Booking slot duration granularity? (30min? 1hr?)
- Maximum bookings per day?

**Impact:** Booking engine cannot be completed without this information.

#### 4. Pricing Discrepancy ⚠️ **IMPORTANT**

**Issue:** Services page shows "From ₦25,000" but packages start at ₦40,000.

**Unknown Questions:**
- Is there a ₦25,000 package that's not shown?
- Are the "From" prices outdated?
- Do prices vary by service type + package duration?

**Action Required:** Client must provide current, accurate pricing.

### 6.2 MEDIUM-RISK AREAS

#### 1. Missing Assets
- Hero video `LANDSCAPE.mp4` referenced but not present
- Need client to provide OR remove video entirely

#### 2. Email Infrastructure
- Currently using Web3Forms (third-party)
- Need to decide: keep Web3Forms OR build own email system?
- Booking confirmations will need email sending capability

#### 3. Image Quality & Rights
- 59 gallery images are base64-encoded (quality degraded)
- Need original high-res images from client
- Confirm image rights/permissions for web use

### 6.3 LOW-RISK AREAS

- Frontend design is already defined (can replicate in React)
- Contact information is clear
- Social media links are known
- Brand colors and typography are established

---

## 7. CLIENT QUESTIONS (BLOCKING/IMPORTANT)

### 7.1 BLOCKING (Cannot proceed without answers)

#### BOOKING SYSTEM
1. **Operating Days:** Are you open 7 days/week, or specific days only?
2. **Booking Capacity:** How many customers can you serve at the same time?
3. **Studio Resources:** Do you have multiple rooms/sets, or one shared space?
4. **Walk-In Policy:** How should the system handle walk-ins vs online bookings?
5. **Booking Slots:** Should bookings be on 30-minute increments, 1-hour, or match package duration exactly?

#### PAYMENT
6. **Bachs Status:** What is the current status of your Bachs account? (Pending/Approved/Live?)
7. **Payment Timing:** Do customers pay full amount upfront, or deposit first?
8. **Refund Policy:** Under what conditions do you issue refunds?

#### PRICING
9. **Pricing Clarification:** Services page shows "From ₦25,000" but packages start at ₦40,000. What is the actual minimum price?
10. **Price Variability:** Do prices change based on service type (e.g. birthday vs corporate)?

### 7.2 IMPORTANT (Needed before production launch)

#### BUSINESS
11. **Official Business Name:** Is it "Photo Arena" or "Photo Arena NG" or something else? (For legal/payment registration)
12. **Business Registration:** Do you have CAC registration number? (May be required for Bachs)
13. **Closed Dates:** Are there specific holidays/dates when the studio is closed?

#### OPERATIONS
14. **Admin Users:** Who will manage bookings? (Owner only, or multiple staff?)
15. **Booking Notifications:** Who should receive booking notifications? (Email? SMS? WhatsApp?)
16. **Manual Booking:** Do you want admin to be able to create bookings for walk-ins?
17. **Cancellation Policy:** How far in advance can customers cancel? Any fees?
18. **Rescheduling Policy:** Can customers reschedule? How many times? Any fees?
19. **No-Show Policy:** What happens if a customer doesn't show up?

#### TECHNICAL
20. **Hosting:** Where do you plan to host the new system? (VPS? Vercel? Railway?)
21. **Domain:** Do you own a domain? (photoarena.com / photoarena.ng / etc.)
22. **Email Service:** Do you want to use your current Web3Forms setup, or switch to your own email sending?

### 7.3 NON-BLOCKING (Can use temporary assumptions)

23. **Gallery Categories:** Are "All, Birthdays, Corporate, Portraits, Kids" the correct categories, or should we add/change any?
24. **Testimonials:** Do you want customers to be able to submit testimonials, or admin-only?
25. **Services Management:** Will you want to add/edit/remove services frequently, or are they stable?
26. **Package Customization:** Do customers ever request custom packages (e.g. 45 mins, 6 photos)?

---

## 8. RECOMMENDED ARCHITECTURE

### 8.1 Technology Stack (Recommended)

#### Frontend
- **Framework:** React 18+ with TypeScript
- **Routing:** React Router v6
- **Styling:** Tailwind CSS (keep existing design system)
- **Forms:** React Hook Form + Zod validation
- **State:** React Query (server state) + Zustand (client state, if needed)
- **Calendar:** react-big-calendar or FullCalendar
- **Build Tool:** Vite

#### Backend
- **Runtime:** Node.js 20+ LTS
- **Framework:** Nest.js (recommended for scalability) OR Express (simpler)
- **Language:** TypeScript
- **Validation:** class-validator + class-transformer (Nest) OR Zod (Express)

#### Database
- **Primary:** PostgreSQL 16+
- **ORM:** Prisma (recommended) OR Drizzle
- **Why PostgreSQL?**
  - Mature, reliable
  - Strong transaction support (critical for booking conflicts)
  - Good hosting options (Supabase, Railway, Render)
  - JSON support for flexible data

#### Authentication
- **Strategy:** JWT (access + refresh tokens)
- **Library:** Passport.js (Nest) OR jsonwebtoken (Express)
- **Password:** bcrypt

#### Payment
- **Provider:** Bachs (when approved)
- **Architecture:** Abstract payment service layer
  ```
  PaymentService (interface)
  └── BachsPaymentService (implementation)
  ```
- **Temporary:** Mock implementation for development

#### Email
- **Options:**
  1. Keep Web3Forms (simple, already working)
  2. Nodemailer + Gmail SMTP (free tier)
  3. SendGrid / Mailgun (paid, more reliable)
  
**Recommendation:** Start with Nodemailer for booking confirmations, keep Web3Forms for contact form.

#### Hosting (Options)
1. **Vercel** (frontend) + **Railway** (backend + DB) — Easiest
2. **Render** (full stack) — Good free tier
3. **VPS** (DigitalOcean/Hetzner) — Most control, requires devops knowledge

### 8.2 Database Schema (High-Level)

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  password  String   // bcrypt hash
  role      Role     @default(ADMIN)
  createdAt DateTime @default(now())
}

enum Role {
  OWNER
  ADMIN
  STAFF
}

model Customer {
  id        Int       @id @default(autoincrement())
  name      String
  phone     String
  email     String?
  bookings  Booking[]
  createdAt DateTime  @default(now())
}

model Service {
  id          Int       @id @default(autoincrement())
  name        String
  description String
  startingPrice Int     // in kobo (₦25,000 = 2500000)
  isActive    Boolean   @default(true)
  packages    Package[]
}

model Package {
  id          Int       @id @default(autoincrement())
  serviceId   Int
  service     Service   @relation(fields: [serviceId], references: [id])
  name        String    // "30 min package"
  duration    Int       // minutes
  outfits     Int
  photos      Int
  price       Int       // in kobo
  isActive    Boolean   @default(true)
  bookings    Booking[]
}

model Booking {
  id          Int       @id @default(autoincrement())
  customerId  Int
  customer    Customer  @relation(fields: [customerId], references: [id])
  packageId   Int
  package     Package   @relation(fields: [packageId], references: [id])
  
  date        DateTime  // booking date
  startTime   DateTime  // start time
  endTime     DateTime  // calculated from package duration
  
  status      BookingStatus @default(PENDING)
  source      BookingSource @default(ONLINE)
  
  payment     Payment?
  
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  @@unique([date, startTime]) // prevent double booking
}

enum BookingStatus {
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
  NO_SHOW
}

enum BookingSource {
  ONLINE
  WALK_IN
  ADMIN
}

model Payment {
  id              Int           @id @default(autoincrement())
  bookingId       Int           @unique
  booking         Booking       @relation(fields: [bookingId], references: [id])
  
  amount          Int           // in kobo
  currency        String        @default("NGN")
  status          PaymentStatus @default(PENDING)
  provider        String        @default("bachs")
  
  transactionId   String?       // Bachs transaction ID
  reference       String        @unique // our reference
  
  paidAt          DateTime?
  createdAt       DateTime      @default(now())
}

enum PaymentStatus {
  PENDING
  PROCESSING
  SUCCESS
  FAILED
  REFUNDED
}

model GalleryImage {
  id          Int      @id @default(autoincrement())
  filename    String
  category    String
  alt         String
  sortOrder   Int      @default(0)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
}

model Testimonial {
  id          Int      @id @default(autoincrement())
  customerName String
  content     String
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
}

model BusinessSettings {
  id          Int      @id @default(autoincrement())
  key         String   @unique
  value       String
  updatedAt   DateTime @updatedAt
}
```

### 8.3 Folder Structure (Proposed)

```
photo arena new/
├── docs/                       ← YOU ARE HERE
│   ├── PROJECT-AUDIT.md
│   ├── ARCHITECTURE.md         ← To be created
│   ├── DATABASE.md             ← To be created
│   ├── API.md                  ← To be created
│   ├── BOOKING-FLOW.md         ← To be created
│   ├── PAYMENT-FLOW.md         ← To be created
│   ├── CLIENT-QUESTIONS.md     ← To be created
│   └── DECISIONS.md            ← To be created
│
├── frontend/                   ← React app
│   ├── public/
│   │   ├── logo.svg
│   │   ├── gallery/
│   │   └── hero-video.mp4
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── Modal.tsx
│   │   │   ├── home/
│   │   │   │   ├── Hero.tsx
│   │   │   │   ├── ServicesSection.tsx
│   │   │   │   └── FAQ.tsx
│   │   │   ├── booking/
│   │   │   │   ├── BookingFlow.tsx
│   │   │   │   ├── PackageSelector.tsx
│   │   │   │   ├── DateTimePicker.tsx
│   │   │   │   └── BookingSummary.tsx
│   │   │   └── admin/
│   │   │       ├── Dashboard.tsx
│   │   │       ├── BookingsList.tsx
│   │   │       └── CustomersList.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Services.tsx
│   │   │   ├── Gallery.tsx
│   │   │   ├── Booking.tsx
│   │   │   ├── Contact.tsx
│   │   │   └── admin/
│   │   │       ├── Login.tsx
│   │   │       └── Dashboard.tsx
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── utils.ts
│   │   ├── hooks/
│   │   ├── types/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                    ← Nest.js / Express API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── bookings/
│   │   │   ├── payments/
│   │   │   ├── customers/
│   │   │   ├── services/
│   │   │   └── admin/
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   ├── decorators/
│   │   │   └── filters/
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── package.json
│   └── .env.example
│
├── shared/                     ← Shared types (if monorepo)
│   └── types/
│
├── .gitignore
├── README.md
└── package.json                ← Root (if monorepo)
```

---

## 9. IMPLEMENTATION PHASES

### Phase 0: ✅ Discovery & Audit (CURRENT)
- [x] Audit old project
- [x] Document existing features
- [x] Extract business data
- [x] Identify unknowns
- [ ] Get client answers to blocking questions

### Phase 1: Foundation (Week 1)
- [ ] Set up monorepo or separate repos
- [ ] Initialize frontend (React + Vite + TypeScript)
- [ ] Initialize backend (Nest.js + TypeScript)
- [ ] Set up PostgreSQL + Prisma
- [ ] Create database schema
- [ ] Seed initial data (services, packages)
- [ ] Set up Git + `.gitignore`

### Phase 2: Frontend Migration (Week 1-2)
- [ ] Extract and convert assets (logo, images to WebP)
- [ ] Build design system in Tailwind (match existing colors/typography)
- [ ] Create reusable components (Navbar, Footer, Button, Card)
- [ ] Migrate Home page
- [ ] Migrate Services page
- [ ] Migrate Gallery page (with real image files)
- [ ] Migrate Contact page

### Phase 3: Backend Core (Week 2)
- [ ] Set up authentication (JWT)
- [ ] Create admin endpoints
- [ ] Create services/packages endpoints (CRUD)
- [ ] Create gallery endpoints (CRUD)
- [ ] Set up file upload (for gallery images)

### Phase 4: Booking Engine (Week 3) ⚠️ **REQUIRES CLIENT ANSWERS**
- [ ] Design availability algorithm
- [ ] Create booking endpoints
- [ ] Implement conflict detection
- [ ] Build calendar availability API
- [ ] Create booking confirmation logic

### Phase 5: Booking Frontend (Week 3)
- [ ] Build BookingFlow component
- [ ] Build DateTimePicker with availability
- [ ] Build PackageSelector
- [ ] Build BookingSummary
- [ ] Integrate with booking API

### Phase 6: Payment (Week 4) ⚠️ **REQUIRES BACHS CREDENTIALS**
- [ ] Create payment service abstraction
- [ ] Implement mock payment (for development)
- [ ] Integrate Bachs (when approved)
- [ ] Implement webhook handling
- [ ] Add payment confirmation page

### Phase 7: Admin Portal (Week 4-5)
- [ ] Admin authentication
- [ ] Admin dashboard (today's bookings, revenue)
- [ ] Bookings management (list, view, confirm, cancel)
- [ ] Customers CRM (list, view, history)
- [ ] Services/packages management

### Phase 8: CMS Features (Week 5)
- [ ] Gallery management (upload, edit, delete, categories)
- [ ] Testimonials management
- [ ] Business settings editor

### Phase 9: Integration & Testing (Week 6)
- [ ] End-to-end booking flow testing
- [ ] Payment flow testing (sandbox)
- [ ] Admin workflow testing
- [ ] Mobile responsiveness testing
- [ ] Accessibility testing (WCAG AA)

### Phase 10: Deployment (Week 6-7)
- [ ] Set up hosting (Vercel + Railway OR Render)
- [ ] Configure production database
- [ ] Set up environment variables
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Configure domain + SSL
- [ ] Test in production

---

## 10. ASSUMPTIONS & DECISIONS

### Assumptions Made

| # | Assumption | Rationale | Risk Level |
|---|-----------|-----------|------------|
| 1 | Studio accepts walk-ins | Mentioned in old site copy "Walk-In Friendly" | LOW |
| 2 | One studio space (not multiple rooms) | No evidence of multiple spaces | MEDIUM |
| 3 | Operating hours are 8AM–6PM daily | Stated in old site, but days not specified | MEDIUM |
| 4 | Full payment required upfront | Standard for small studios | MEDIUM |
| 5 | Bookings on 30-minute increments | Matches smallest package (30 min) | LOW |
| 6 | No same-day booking cutoff | Not specified, but common to allow | LOW |

**These assumptions will be confirmed with client before implementation.**

### Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **React over Vue/Svelte** | Largest ecosystem, best hiring pool in Nigeria, mature tooling |
| **TypeScript required** | Type safety critical for booking/payment logic, reduces bugs |
| **Nest.js over Express** | Better structure for growing project, built-in DI, easier to scale |
| **PostgreSQL over MySQL** | Better transaction support, JSON types, strong community |
| **Prisma over TypeORM** | Better TypeScript integration, clearer migrations, active development |
| **JWT over sessions** | Easier to scale, works with separate frontend/backend, mobile-friendly |
| **Monorepo (optional)** | Easier to share types between frontend/backend, single repo |
| **Tailwind CSS** | Matches existing design system, faster development, smaller bundle |

---

## 11. NEXT STEPS

### Immediate Actions (Before Coding)

1. **Send CLIENT-QUESTIONS.md to client** (to be created)
2. **Get blocking answers** (operating days, booking capacity, Bachs status)
3. **Review and approve this audit** with client/owner
4. **Approve recommended architecture**
5. **Approve database schema**
6. **Approve implementation phases**

### After Approval

1. Create remaining documentation:
   - `ARCHITECTURE.md` (detailed technical architecture)
   - `DATABASE.md` (full schema with relationships)
   - `API.md` (endpoint specifications)
   - `BOOKING-FLOW.md` (booking algorithm documentation)
   - `PAYMENT-FLOW.md` (Bachs integration flow)
   - `CLIENT-QUESTIONS.md` (formatted questions for client)
   - `DECISIONS.md` (log of architectural decisions)

2. Begin Phase 1: Foundation
   - Initialize repositories
   - Set up development environment
   - Create project structure

---

## 12. SUMMARY

### What We Know
- ✅ Complete understanding of existing frontend
- ✅ All business data extracted
- ✅ Visual design system documented
- ✅ Services and pricing extracted
- ✅ Contact information confirmed
- ✅ Asset inventory complete

### What We Don't Know (BLOCKING)
- ❌ Exact operating days (7 days or specific days?)
- ❌ Booking capacity (how many simultaneous customers?)
- ❌ Studio layout (1 space or multiple rooms?)
- ❌ Walk-in handling policy
- ❌ Bachs account status
- ❌ Payment timing (full upfront or deposit?)

### What We Don't Know (IMPORTANT)
- ⚠️ Official business registration details
- ⚠️ Refund/cancellation policies
- ⚠️ Admin user requirements
- ⚠️ Hosting preferences

### Critical Path
1. **Get blocking answers** → Design booking engine
2. **Get Bachs credentials** → Implement payment
3. **Everything else** → Can proceed in parallel

---

## CONCLUSION

The existing Photo Arena website is a well-designed static landing page that **simulates** a booking experience but has no backend functionality. A complete rebuild is required.

**Estimated Timeline:** 6-8 weeks from approval to production launch.

**Estimated Effort:**
- Phase 0 (Discovery): ✅ COMPLETE
- Phase 1-3 (Foundation + Frontend): ~2 weeks
- Phase 4-6 (Booking + Payment): ~2 weeks ⚠️ *Dependent on client answers*
- Phase 7-8 (Admin + CMS): ~1-2 weeks
- Phase 9-10 (Testing + Deployment): ~1 week

**Dependencies:**
- Client answers to blocking questions (Phase 4 cannot start without these)
- Bachs credentials (Phase 6 cannot complete without these)
- Original gallery images (Phase 2 can proceed with base64 extracted images)

**Recommendation:** Review this audit, answer blocking questions, and approve the proposed architecture before proceeding to implementation.

---

**Document Status:** DRAFT v1.0  
**Next Review:** After client feedback  
**Last Updated:** 2026-09-11
