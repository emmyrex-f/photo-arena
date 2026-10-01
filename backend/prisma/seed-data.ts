/**
 * Provisional seed content ported VERBATIM from the old static website
 * (`photo arena old/index_27.html`). Prices are provisional (D-19) — the owner
 * edits them in the admin portal. Do not invent prices here.
 */
import type { ServiceKind } from "@prisma/client";

export type SeedTier = {
  durationMinutes: number;
  includes: string;
  priceKobo: number;
  /** Extra note shown on the old rate card (e.g. sibling surcharge). */
  note?: string;
};

/** Structured deliverables parsed from the old includes line — not hardcoded per package. */
export function deliverablesFromIncludes(includes: string): {
  outfitCount: number | null;
  backdropCount: number | null;
  editedPhotoCount: number | null;
} {
  const outfit = includes.match(/(\d+)\s+outfits?/i);
  const backdrop = includes.match(/(\d+)\s+backdrops?/i);
  const photos = includes.match(/(\d+)\s+photos?/i);
  return {
    outfitCount: outfit ? Number(outfit[1]) : null,
    backdropCount: backdrop ? Number(backdrop[1]) : null,
    editedPhotoCount: photos ? Number(photos[1]) : null,
  };
}

export type SeedService = {
  slug: string;
  name: string;
  kind: ServiceKind;
  /** Short card copy (old `bk-card-tag` / `bk-booth-sub`). */
  summary: string;
  /** Longer copy (old Services page card or Home package card). */
  description: string;
  tiers: SeedTier[];
};

const naira = (n: number) => n * 100;

/** "Bring your own photographer or phone — we supply the set." (old Space Rental intro) */
const SET_HIRE_INCLUDES = "Bring your own photographer or phone — we supply the set.";

export const seedServices: SeedService[] = [
  // ── Photography sessions (old Bookings page, "Curated Shoot Packages") ──
  {
    slug: "personal-birthday",
    name: "Personal / Birthday Shoots",
    kind: "SESSION",
    summary: "Celebrate in style — solo or with your crew",
    description:
      "Celebrate your special day with stunning, joyful photos that capture the energy, excitement, and pure happiness of your birthday moment.",
    tiers: [
      { durationMinutes: 15, includes: "1 outfit · 1 backdrop · 3 photos", priceKobo: naira(20_000) },
      { durationMinutes: 30, includes: "2 outfits · 2 backdrops · 8 photos", priceKobo: naira(40_000) },
      { durationMinutes: 60, includes: "3 outfits · 3 backdrops · 10 photos", priceKobo: naira(55_000) },
      { durationMinutes: 90, includes: "4 outfits · 4 backdrops · 14 photos", priceKobo: naira(70_000) },
    ],
  },
  {
    slug: "pre-wedding",
    name: "Pre-Wedding / Couples",
    kind: "SESSION",
    summary: "Tell your love story before the big day",
    description:
      "Tell your love story before the big day. Our pre-wedding shoots are intimate, romantic, and beautifully crafted for couples who want something truly special.",
    tiers: [
      { durationMinutes: 30, includes: "1 outfit · 3 photos", priceKobo: naira(40_000) },
      { durationMinutes: 60, includes: "2 outfits · 8 photos", priceKobo: naira(60_000) },
      { durationMinutes: 90, includes: "3 outfits · 12 photos", priceKobo: naira(70_000) },
      { durationMinutes: 120, includes: "4 outfits · 15 photos", priceKobo: naira(90_000) },
    ],
  },
  {
    slug: "family",
    name: "Family Shoots",
    kind: "SESSION",
    summary: "Timeless portraits for the whole family",
    description: "Timeless portraits for the whole family.",
    tiers: [
      { durationMinutes: 30, includes: "1 outfit · 5 photos", priceKobo: naira(40_000) },
      { durationMinutes: 60, includes: "2 outfits · 8 photos", priceKobo: naira(60_000) },
      { durationMinutes: 90, includes: "3 outfits · 14 photos", priceKobo: naira(80_000) },
    ],
  },
  {
    slug: "corporate",
    name: "Corporate Headshots",
    kind: "SESSION",
    summary: "Sharp, professional — make your first impression count",
    description:
      "First impressions matter. Our corporate headshots are sharp, confident, and polished — ideal for LinkedIn, company websites, and executive profiles.",
    tiers: [
      { durationMinutes: 15, includes: "1 outfit · 1 backdrop · 3 photos", priceKobo: naira(25_000) },
      { durationMinutes: 30, includes: "2 outfits · 2 backdrops · 8 photos", priceKobo: naira(50_000) },
      { durationMinutes: 60, includes: "3 outfits · 3 backdrops · 10 photos", priceKobo: naira(69_000) },
      { durationMinutes: 90, includes: "4 outfits · 4 backdrops · 14 photos", priceKobo: naira(88_000) },
    ],
  },
  {
    slug: "maternity",
    name: "Maternity Shoots",
    kind: "SESSION",
    summary: "Celebrate the beauty of new life",
    description: "Celebrate the beauty of new life.",
    tiers: [
      { durationMinutes: 30, includes: "1 outfit · 1 theme · 4 photos (premium retouch)", priceKobo: naira(25_000) },
      { durationMinutes: 60, includes: "2 outfits · 2 backdrops · 8 photos (premium retouch)", priceKobo: naira(40_000) },
      { durationMinutes: 120, includes: "3 outfits · 3 backdrops · 15 photos (premium retouch)", priceKobo: naira(60_000) },
    ],
  },
  {
    slug: "bundle-of-joy-0-1",
    name: "Bundle of Joy · 0–1 Year",
    kind: "SESSION",
    summary: "Precious newborn & infant sessions",
    description:
      "Capture the magic of childhood with fun, vibrant kids' shoots designed to bring out natural smiles and precious expressions in a safe, playful environment.",
    tiers: [
      { durationMinutes: 60, includes: "1 outfit · 1 theme · 4 photos (premium retouch)", priceKobo: naira(40_000) },
      { durationMinutes: 120, includes: "2 outfits · 2 themes · 10 photos (premium retouch)", priceKobo: naira(60_000) },
      {
        durationMinutes: 180,
        includes: "3 outfits · 3 themes · 14 photos (premium retouch)",
        priceKobo: naira(80_000),
        note: "Siblings/parent +₦5,000",
      },
    ],
  },
  {
    slug: "bundle-of-joy-2-6",
    name: "Bundle of Joy · 2–6 Years",
    kind: "SESSION",
    summary: "Playful sessions for toddlers & young children",
    description:
      "Capture the magic of childhood with fun, vibrant kids' shoots designed to bring out natural smiles and precious expressions in a safe, playful environment.",
    tiers: [
      { durationMinutes: 30, includes: "1 outfit · 1 theme · 4 photos", priceKobo: naira(30_000) },
      { durationMinutes: 60, includes: "2 outfits · 2 themes · 8 photos", priceKobo: naira(50_000) },
      { durationMinutes: 120, includes: "3 outfits · 3 themes · 12 photos", priceKobo: naira(65_000) },
      {
        durationMinutes: 180,
        includes: "4 outfits · 4 themes · 16 photos",
        priceKobo: naira(75_000),
        note: "Siblings/parent +₦5,000",
      },
    ],
  },
  {
    slug: "teens-7-15",
    name: "Teens Shoot · 7–15 Years",
    kind: "SESSION",
    summary: "Confidence, style & personality — captured",
    description: "Confidence, style & personality — captured.",
    tiers: [
      { durationMinutes: 30, includes: "1 outfit · 1 themed setup · 4 photos", priceKobo: naira(25_000) },
      { durationMinutes: 45, includes: "2 outfits · 2 themed setups · 8 photos", priceKobo: naira(45_000) },
      { durationMinutes: 90, includes: "3 outfits · 3 themed setups · 12 photos", priceKobo: naira(60_000) },
    ],
  },
  {
    slug: "video-reels",
    name: "Studio Video Content",
    kind: "SESSION",
    summary: "4K luxury video reels & studio content sessions",
    description:
      "Studio video content & 4K reels sessions by NUFX. Delivery within 72 hours. 24-hour express delivery available (+50%).",
    tiers: [
      { durationMinutes: 30, includes: "1 outfit · 1 4K Reel (15–30 secs)", priceKobo: naira(50_000) },
      { durationMinutes: 60, includes: "2 outfits · 2 4K Reels (30 sec–1 min each)", priceKobo: naira(90_000) },
      { durationMinutes: 120, includes: "3 outfits · 3 4K Reels", priceKobo: naira(140_000) },
      { durationMinutes: 150, includes: "4 outfits · 4 4K Reels + 1 combo reel of all 4 outfits", priceKobo: naira(200_000) },
    ],
  },

  // ── Aesthetic Background Sessions ("Premium Themed Sets") ──
  {
    slug: "set-curated-wall",
    name: "The Curated Wall",
    kind: "SET",
    summary: "A sculptural white niche wall — dramatic & editorial",
    description:
      "Individually bookable premium studio set — architecturally designed for maximum visual impact. A sculptural white niche wall — dramatic & editorial.",
    tiers: [
      { durationMinutes: 15, includes: "1 outfit · 4 photos", priceKobo: naira(30_000) },
      { durationMinutes: 30, includes: "2 outfits · 8 photos", priceKobo: naira(55_000) },
    ],
  },
  {
    slug: "set-curated-cove",
    name: "The Curated Cove",
    kind: "SET",
    summary: "Arched alcoves & soft lighting — calm, luxurious",
    description:
      "Individually bookable premium studio set — architecturally designed for maximum visual impact. Arched alcoves & soft lighting — calm, luxurious.",
    tiers: [
      { durationMinutes: 15, includes: "1 outfit · 4 photos", priceKobo: naira(30_000) },
      { durationMinutes: 30, includes: "2 outfits · 8 photos", priceKobo: naira(55_000) },
    ],
  },
  {
    slug: "set-arched-retreat",
    name: "The Arched Retreat",
    kind: "SET",
    summary: "Warm golden arches — intimate & dreamy",
    description:
      "Individually bookable premium studio set — architecturally designed for maximum visual impact. Warm golden arches — intimate & dreamy.",
    tiers: [
      { durationMinutes: 15, includes: "1 outfit · 4 photos", priceKobo: naira(30_000) },
      { durationMinutes: 30, includes: "2 outfits · 8 photos", priceKobo: naira(45_000) },
    ],
  },
  {
    slug: "set-aurora-wave",
    name: "Aurora Wave",
    kind: "SET",
    summary: "LED-lit floating shelves on a cloud-blue wall",
    description:
      "Individually bookable premium studio set — architecturally designed for maximum visual impact. LED-lit floating shelves on a cloud-blue wall.",
    tiers: [
      { durationMinutes: 15, includes: "1 outfit · 4 photos", priceKobo: naira(25_000) },
      { durationMinutes: 30, includes: "2 outfits · 8 photos", priceKobo: naira(55_000) },
    ],
  },

  // ── Themed Photo Booths (Space Rental) ──
  {
    slug: "booth-swing-attitude",
    name: "Swing Attitude",
    kind: "BOOTH",
    summary: "Orange swing booth with cloud canopy",
    description:
      "Themed photo booth hire. Bring your own photographer or phone — we supply the set. Perfect for content creators, brand shoots & events.",
    tiers: [
      { durationMinutes: 15, includes: SET_HIRE_INCLUDES, priceKobo: naira(15_000) },
      { durationMinutes: 30, includes: SET_HIRE_INCLUDES, priceKobo: naira(25_000) },
      { durationMinutes: 60, includes: SET_HIRE_INCLUDES, priceKobo: naira(45_000) },
    ],
  },
  {
    slug: "booth-odogwu-vibes",
    name: "Odogwu Vibes",
    kind: "BOOTH",
    summary: "Bold typographic backdrop — boss energy",
    description:
      "Themed photo booth hire. Bring your own photographer or phone — we supply the set. Perfect for content creators, brand shoots & events.",
    tiers: [
      { durationMinutes: 15, includes: SET_HIRE_INCLUDES, priceKobo: naira(15_000) },
      { durationMinutes: 30, includes: SET_HIRE_INCLUDES, priceKobo: naira(25_000) },
      { durationMinutes: 60, includes: SET_HIRE_INCLUDES, priceKobo: naira(45_000) },
    ],
  },
  {
    slug: "booth-lets-party",
    name: "Let's Party Booth",
    kind: "BOOTH",
    summary: "Neon nights, vinyl walls & checkerboard floor",
    description:
      "Themed photo booth hire. Bring your own photographer or phone — we supply the set. Perfect for content creators, brand shoots & events.",
    tiers: [
      { durationMinutes: 15, includes: SET_HIRE_INCLUDES, priceKobo: naira(15_000) },
      { durationMinutes: 30, includes: SET_HIRE_INCLUDES, priceKobo: naira(25_000) },
      { durationMinutes: 60, includes: SET_HIRE_INCLUDES, priceKobo: naira(45_000) },
    ],
  },
  {
    slug: "booth-telephone",
    name: "Telephone Booth",
    kind: "BOOTH",
    summary: "Iconic cream telephone box — timeless & fun",
    description:
      "Themed photo booth hire. Bring your own photographer or phone — we supply the set. Perfect for content creators, brand shoots & events.",
    tiers: [
      { durationMinutes: 15, includes: SET_HIRE_INCLUDES, priceKobo: naira(15_000) },
      { durationMinutes: 30, includes: SET_HIRE_INCLUDES, priceKobo: naira(25_000) },
      { durationMinutes: 60, includes: SET_HIRE_INCLUDES, priceKobo: naira(45_000) },
    ],
  },

  // ── Premium Backdrop Rental (Space Rental) ──
  {
    slug: "backdrop-curated-wall",
    name: "The Curated Wall (Backdrop Rental)",
    kind: "BACKDROP",
    summary: "Premium sculptural niche wall rental",
    description:
      "Premium backdrop rental. Bring your own photographer or phone — we supply the set. Perfect for content creators, brand shoots & events.",
    tiers: [
      { durationMinutes: 20, includes: SET_HIRE_INCLUDES, priceKobo: naira(25_000) },
      { durationMinutes: 60, includes: SET_HIRE_INCLUDES, priceKobo: naira(50_000) },
    ],
  },
  {
    slug: "backdrop-curated-cove",
    name: "The Curated Cove (Backdrop Rental)",
    kind: "BACKDROP",
    summary: "Arched alcove backdrop rental",
    description:
      "Premium backdrop rental. Bring your own photographer or phone — we supply the set. Perfect for content creators, brand shoots & events.",
    tiers: [
      { durationMinutes: 20, includes: SET_HIRE_INCLUDES, priceKobo: naira(25_000) },
      { durationMinutes: 60, includes: SET_HIRE_INCLUDES, priceKobo: naira(50_000) },
    ],
  },
  {
    slug: "backdrop-arched-retreat",
    name: "The Arched Retreat (Backdrop Rental)",
    kind: "BACKDROP",
    summary: "Golden arch backdrop rental",
    description:
      "Premium backdrop rental. Bring your own photographer or phone — we supply the set. Perfect for content creators, brand shoots & events.",
    tiers: [
      { durationMinutes: 20, includes: SET_HIRE_INCLUDES, priceKobo: naira(20_000) },
      { durationMinutes: 60, includes: SET_HIRE_INCLUDES, priceKobo: naira(45_000) },
    ],
  },
  {
    slug: "backdrop-aurora-wave",
    name: "Aurora Wave (Backdrop Rental)",
    kind: "BACKDROP",
    summary: "LED floating-shelf backdrop rental",
    description:
      "Premium backdrop rental. Bring your own photographer or phone — we supply the set. Perfect for content creators, brand shoots & events.",
    tiers: [
      { durationMinutes: 20, includes: SET_HIRE_INCLUDES, priceKobo: naira(25_000) },
      { durationMinutes: 60, includes: SET_HIRE_INCLUDES, priceKobo: naira(50_000) },
    ],
  },

  // ── Studio space rental (old Home "Space Rental" card: From ₦40,000/hr) ──
  {
    slug: "space-rental",
    name: "Studio Space Rental",
    kind: "RENTAL",
    summary: "Hourly hire of the studio, lighting, and backdrops for photographers and brands",
    description:
      "Rent our fully-equipped premium studio space by the hour — ideal for photographers, content creators, and brands.",
    tiers: [
      {
        durationMinutes: 60,
        includes: "Full studio access · All backdrops & props · Professional lighting rigs · Available every day 8AM–6PM",
        priceKobo: naira(40_000),
      },
    ],
  },
];

/** Old Home page FAQ — 7 Q&As, verbatim. */
export const seedFaqs: Array<{ question: string; answer: string }> = [
  {
    question: "Do I need to book an appointment in advance?",
    answer:
      "No appointment is necessary! Photo Arena is a walk-in studio — simply show up any day between 8AM and 6PM and we'll get you set up. For larger group bookings or special packages, you're welcome to call ahead so we can prepare the right setup for you.",
  },
  {
    question: "What should I wear to my shoot?",
    answer:
      "Wear something you feel confident and comfortable in. Solid colours tend to photograph beautifully, but we encourage you to express your personal style. For corporate shoots, smart/professional attire works best. For birthday and personal shoots, feel free to wear outfits that reflect your personality — you can even bring a change of clothing!",
  },
  {
    question: "How long does a typical shoot take?",
    answer:
      "Most individual shoots take between 30 minutes to 1 hour. Kids and family sessions may take a little longer as we allow plenty of time for the children to warm up and get comfortable. Pre-wedding sessions typically run 1–2 hours depending on the number of looks and setups. We never rush — we want you to get the best possible result.",
  },
  {
    question: "When will I receive my photos?",
    answer:
      "Passport and visa photos are printed on the same day. For other sessions, edited digital photos are typically delivered within 24–72 hours via WhatsApp or email. If you need prints, we can arrange same-day printing for select packages. Please ask our team when you arrive for the latest turnaround times.",
  },
  {
    question: "Can I use my own phone to take photos in the studio?",
    answer:
      "Absolutely! We have a dedicated Personal Arena space specifically designed for mobile phone selfie shoots. You bring your phone, we set up the perfect lighting and backdrop, and you create your content. This is included in our personal shoot packages — just let us know when you arrive that you'd like the phone arena experience.",
  },
  {
    question: "Do you offer studio rental for photographers?",
    answer:
      "Yes! Our studio space is available for hire starting from ₦40,000 per hour. You get full access to our studio including all backdrops, props, and professional lighting equipment. This is ideal for photographers, videographers, content creators, and brands who need a premium space. Call us on 09059813823 to check availability and discuss your requirements.",
  },
  {
    question: "How do I pay for my session?",
    answer:
      "We accept cash and bank transfers at the studio. Payment is made on the day of your shoot. For space rental and larger package bookings, a deposit may be required to secure your time slot. Please call us ahead of time to confirm details for large bookings.",
  },
];

/** Old Home page testimonials — stored for owner review, NOT published (D-20). */
export const seedTestimonials: Array<{ quote: string; name: string; role: string; rating: number }> = [
  {
    quote:
      "Amazing experience from start to finish! The studio was well set up, the lighting was perfect and the photos came out absolutely stunning. My birthday shoot was everything I imagined and more. I will definitely be coming back!",
    name: "Chioma A.",
    role: "Birthday Shoot",
    rating: 5,
  },
  {
    quote:
      "The team at Photo Arena made my kids feel so comfortable and relaxed. The themed sets are beautiful and the photographers really know how to capture children naturally. The photos exceeded my expectations — so vivid and professional!",
    name: "Temi O.",
    role: "Kids Photography",
    rating: 5,
  },
  {
    quote:
      "I needed a last-minute corporate headshot and they delivered! No appointment needed, I just walked in. The result was so clean and professional — my LinkedIn profile has never looked better. Highly recommend for any corporate shoots.",
    name: "Emeka N.",
    role: "Corporate Headshot",
    rating: 5,
  },
  {
    quote:
      "Our pre-wedding photos were done here and we are completely in love with every single shot. The backdrops are stunning, the lighting is world-class. Photo Arena is hands down the best studio in Port Harcourt. Thank you so much!",
    name: "Ada & Chidi",
    role: "Pre-Wedding Shoot",
    rating: 5,
  },
];

/** Gallery files that exist in frontend/public/gallery (ids/alt/categories from portfolio.generated.ts). */
export const seedGallery: Array<{ id: string; file: string; alt: string; category: string; featured: boolean }> = [
  { id: "pa-01", file: "01-birthdays.jpg", alt: "Birthday Photoshoot at Photo Arena", category: "birthdays", featured: true },
  { id: "pa-02", file: "02-birthdays.jpg", alt: "Birthday Photoshoot at Photo Arena", category: "birthdays", featured: true },
  { id: "pa-03", file: "03-birthdays.jpg", alt: "Birthday Photoshoot at Photo Arena", category: "birthdays", featured: true },
  { id: "pa-04", file: "04-birthdays.jpg", alt: "Birthday Photoshoot at Photo Arena", category: "birthdays", featured: true },
  { id: "pa-05", file: "05-birthdays.jpg", alt: "Birthday Photoshoot at Photo Arena", category: "birthdays", featured: true },
  { id: "pa-06", file: "06-portraits.jpg", alt: "Professional Portrait at Photo Arena", category: "portraits", featured: true },
  { id: "pa-07", file: "07-portraits.jpg", alt: "Professional Portrait at Photo Arena", category: "portraits", featured: true },
  { id: "pa-08", file: "08-portraits.jpg", alt: "Professional Portrait at Photo Arena", category: "portraits", featured: true },
  { id: "pa-09", file: "09-portraits.jpg", alt: "Professional Portrait at Photo Arena", category: "portraits", featured: false },
  { id: "pa-10", file: "10-corporate.jpg", alt: "Corporate Headshot at Photo Arena", category: "corporate", featured: false },
  { id: "pa-11", file: "11-corporate.jpg", alt: "Corporate Headshot at Photo Arena", category: "corporate", featured: false },
  { id: "pa-12", file: "12-corporate.jpg", alt: "Corporate Headshot at Photo Arena", category: "corporate", featured: false },
  { id: "pa-13", file: "13-corporate.jpg", alt: "Corporate Headshot at Photo Arena", category: "corporate", featured: false },
  { id: "pa-14", file: "14-corporate.jpg", alt: "Corporate Headshot at Photo Arena", category: "corporate", featured: false },
  { id: "pa-15", file: "15-kids.jpg", alt: "Children Photography at Photo Arena", category: "kids", featured: false },
  { id: "pa-16", file: "16-kids.jpg", alt: "Children Photography at Photo Arena", category: "kids", featured: false },
  { id: "pa-17", file: "17-kids.jpg", alt: "Children Photography at Photo Arena", category: "kids", featured: false },
  { id: "pa-18", file: "18-kids.jpg", alt: "Children Photography at Photo Arena", category: "kids", featured: false },
  { id: "pa-19", file: "19-kids.jpg", alt: "Children Photography at Photo Arena", category: "kids", featured: false },
  { id: "pa-20", file: "20-kids.jpg", alt: "Children Photography at Photo Arena", category: "kids", featured: false },
  { id: "pa-21", file: "21-kids.jpg", alt: "Children Photography at Photo Arena", category: "kids", featured: false },
  { id: "pa-22", file: "22-kids.jpg", alt: "Children Photography at Photo Arena", category: "kids", featured: false },
];

const INSTAGRAM_URL = "https://www.instagram.com/photoarenang";
const FACEBOOK_URL = "https://www.facebook.com/share/1DKYw3rfJK/";
const TIKTOK_URL = "https://www.tiktok.com/@photoarenang";

export function buildSeedSettings(env: NodeJS.ProcessEnv): Record<string, string> {
  return {
    // site.*
    "site.name": "Photo Arena",
    "site.tagline": "Port Harcourt's premier walk-in portrait studio.",
    "site.phone": "09059813823",
    "site.email": "photoarenang@gmail.com",
    "site.whatsapp": "https://api.whatsapp.com/send/?phone=2349059813823",
    "site.address": "10 Prof Okujagu Street, off Peter Odili Road, Port Harcourt",
    "site.hours.weekday": "8:00 AM – 6:00 PM",
    "site.hours.sunday": "12:00 PM – 6:00 PM",
    "site.mapEmbed":
      "https://www.openstreetmap.org/export/embed.html?bbox=7.013%2C4.798%2C7.033%2C4.818&layer=mapnik&marker=4.808%2C7.023",

    // social.*
    "social.instagram": INSTAGRAM_URL,
    "social.facebook": FACEBOOK_URL,
    "social.tiktok": TIKTOK_URL,

    // hero.* (old hero: "Where Every Shot Becomes a Masterpiece")
    "hero.headline": "Where every shot becomes a masterpiece",
    "hero.subheadline":
      "Professional lighting, stunning backdrops, and a team that makes every visit feel effortless.",
    "hero.videoUrl": "/LANDSCAPE.mp4",

    // tour.* (old "Take a Tour of Our Studio")
    "tour.heading": "Take a Tour of Our Studio",
    "tour.body":
      "Before you walk in, walk through. See the backdrops, the lighting, the space — and imagine yourself in the frame. Our studio is designed to make every client feel comfortable, inspired, and ready to create something beautiful.",
    "tour.videoUrl": "/tour.mp4",

    // cta.* (home booking CTA)
    "cta.heading": "Ready to book your session?",
    "cta.body":
      "Reserve a studio session online and receive 5% off. Walk-ins are welcome Monday–Saturday 8:00 AM – 6:00 PM and Sunday 12:00 PM – 6:00 PM.",
    "cta.buttonLabel": "Book a Session",
    "cta.buttonHref": "/book",

    // about.* (home About strip)
    "about.headline": "Welcome",
    "about.body":
      "Photo Arena is a walk-in portrait studio in Port Harcourt. The room, the lights, and the sets are ready. You bring the occasion.",
    "about.imageUrl": "/media/about.jpg",
    "about.ctaLabel": "Read More",
    "about.ctaHref": "/about",

    // instagram.* (static strip for now)
    "instagram.items": JSON.stringify([
      { image: "/gallery/01-birthdays.jpg", href: INSTAGRAM_URL },
      { image: "/gallery/06-portraits.jpg", href: INSTAGRAM_URL },
      { image: "/gallery/10-corporate.jpg", href: INSTAGRAM_URL },
      { image: "/gallery/15-kids.jpg", href: INSTAGRAM_URL },
      { image: "/gallery/03-birthdays.jpg", href: INSTAGRAM_URL },
      { image: "/gallery/08-portraits.jpg", href: INSTAGRAM_URL },
    ]),

    // analytics.* (empty until the owner supplies IDs; loaded only after consent)
    "analytics.ga4Id": "",
    "analytics.metaPixelId": "",

    // seo.*
    "seo.defaultTitle": "Photo Arena — Premium Walk-in Portrait Studio in Port Harcourt",
    "seo.defaultDescription":
      "Port Harcourt's premier walk-in portrait studio. Birthday, corporate, family, pre-wedding and kids photography at 10 Prof Okujagu Street, off Peter Odili Road.",
    "seo.ogImage": "/gallery/01-birthdays.jpg",

    // policies.* (old Bookings page "Studio Policies" strip, verbatim values)
    "policies.deliveryDays": "3–4 working days",
    "policies.expressPercent": "30",
    "policies.expressMaxPhotos": "8",
    "policies.expressNote": "Within 24hrs · +30% charge (max 8 photos)",
    "policies.extraImageKobo": String(naira(3_000)),
    "policies.vatPercent": "7.5",
    "policies.accompanyingMax": "1",
    "policies.promoUsage": "Photo Arena may use photos for promos unless exclusive package purchased",
    "policies.nonRefundable": "true",
    "policies.rescheduleFeePercent": "15",
    "policies.onlineDiscountPercent": "5",

    // booking.* (admin-only)
    "booking.slotIncrementMinutes": "30",
    "booking.bufferMinutes": "0",
    "booking.holdDurationMinutes": "15",
    "booking.sameDayMinimumNoticeMinutes": "0",
    "booking.timezone": "Africa/Lagos",

    // notifications.* (admin-only)
    "notifications.recipients": (env.NOTIFICATION_EMAIL_RECIPIENTS ?? "").trim(),
    "notifications.reminder24h": "true",
    "notifications.reminder2h": "true",
  };
}

/** Legacy unprefixed keys from the first seed; replaced by `booking.*`. */
export const legacySettingKeys = [
  "slotIncrementMinutes",
  "bufferMinutes",
  "holdDurationMinutes",
  "sameDayMinimumNoticeMinutes",
  "timezone",
];
