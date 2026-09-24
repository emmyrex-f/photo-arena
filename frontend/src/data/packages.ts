import type { PublicPackage, PublicService, ServiceKind } from "../lib/publicApi";

/**
 * Provisional catalogue copied from the old website (Bookings page).
 * Used ONLY when GET /public/services is unavailable. The owner confirms the production list in admin.
 * Shape mirrors the API contract so components never branch on the data source.
 */

type Tier = { minutes: number; includes: string; naira: number };

type Seed = {
  slug: string;
  name: string;
  kind: ServiceKind;
  summary: string;
  description?: string;
  note?: string;
  tiers: Tier[];
};

const seeds: Seed[] = [
  /* ---------------- Photography sessions ---------------- */
  {
    slug: "personal-birthday",
    name: "Personal / Birthday Shoots",
    kind: "SESSION",
    summary: "Celebrate in style — solo or with your crew.",
    tiers: [
      { minutes: 15, includes: "1 outfit · 1 backdrop · 3 photos", naira: 20_000 },
      { minutes: 30, includes: "2 outfits · 2 backdrops · 8 photos", naira: 40_000 },
      { minutes: 60, includes: "3 outfits · 3 backdrops · 10 photos", naira: 55_000 },
      { minutes: 90, includes: "4 outfits · 4 backdrops · 14 photos", naira: 70_000 },
    ],
  },
  {
    slug: "pre-wedding",
    name: "Pre-Wedding / Couples",
    kind: "SESSION",
    summary: "Tell your love story before the big day.",
    tiers: [
      { minutes: 30, includes: "1 outfit · 3 photos", naira: 40_000 },
      { minutes: 60, includes: "2 outfits · 8 photos", naira: 60_000 },
      { minutes: 90, includes: "3 outfits · 12 photos", naira: 70_000 },
      { minutes: 120, includes: "4 outfits · 15 photos", naira: 90_000 },
    ],
  },
  {
    slug: "family",
    name: "Family Shoots",
    kind: "SESSION",
    summary: "Timeless portraits for the whole family.",
    tiers: [
      { minutes: 30, includes: "1 outfit · 5 photos", naira: 40_000 },
      { minutes: 60, includes: "2 outfits · 8 photos", naira: 60_000 },
      { minutes: 90, includes: "3 outfits · 14 photos", naira: 80_000 },
    ],
  },
  {
    slug: "corporate",
    name: "Corporate Headshots",
    kind: "SESSION",
    summary: "Sharp, professional — make your first impression count.",
    tiers: [
      { minutes: 15, includes: "1 outfit · 1 backdrop · 3 photos", naira: 25_000 },
      { minutes: 30, includes: "2 outfits · 2 backdrops · 8 photos", naira: 50_000 },
      { minutes: 60, includes: "3 outfits · 3 backdrops · 10 photos", naira: 69_000 },
      { minutes: 90, includes: "4 outfits · 4 backdrops · 14 photos", naira: 88_000 },
    ],
  },
  {
    slug: "maternity",
    name: "Maternity Shoots",
    kind: "SESSION",
    summary: "Celebrate the beauty of new life.",
    tiers: [
      { minutes: 30, includes: "1 outfit · 1 theme · 4 photos (premium retouch)", naira: 25_000 },
      { minutes: 60, includes: "2 outfits · 2 backdrops · 8 photos (premium retouch)", naira: 40_000 },
      { minutes: 120, includes: "3 outfits · 3 backdrops · 15 photos (premium retouch)", naira: 60_000 },
    ],
  },
  {
    slug: "bundle-of-joy-0-1",
    name: "Bundle of Joy · 0–1 Year",
    kind: "SESSION",
    summary: "Precious newborn and infant sessions.",
    note: "Siblings or a parent in frame: +₦5,000.",
    tiers: [
      { minutes: 60, includes: "1 outfit · 1 theme · 4 photos (premium retouch)", naira: 40_000 },
      { minutes: 120, includes: "2 outfits · 2 themes · 10 photos (premium retouch)", naira: 60_000 },
      { minutes: 180, includes: "3 outfits · 3 themes · 14 photos (premium retouch)", naira: 80_000 },
    ],
  },
  {
    slug: "bundle-of-joy-2-6",
    name: "Bundle of Joy · 2–6 Years",
    kind: "SESSION",
    summary: "Playful sessions for toddlers and young children.",
    note: "Siblings or a parent in frame: +₦5,000.",
    tiers: [
      { minutes: 30, includes: "1 outfit · 1 theme · 4 photos", naira: 30_000 },
      { minutes: 60, includes: "2 outfits · 2 themes · 8 photos", naira: 50_000 },
      { minutes: 120, includes: "3 outfits · 3 themes · 12 photos", naira: 65_000 },
      { minutes: 180, includes: "4 outfits · 4 themes · 16 photos", naira: 75_000 },
    ],
  },
  {
    slug: "teens-7-15",
    name: "Teens Shoot · 7–15 Years",
    kind: "SESSION",
    summary: "Confidence, style and personality — captured.",
    tiers: [
      { minutes: 30, includes: "1 outfit · 1 themed setup · 4 photos", naira: 25_000 },
      { minutes: 45, includes: "2 outfits · 2 themed setups · 8 photos", naira: 45_000 },
      { minutes: 90, includes: "3 outfits · 3 themed setups · 12 photos", naira: 60_000 },
    ],
  },

  /* ---------------- Signature sets ---------------- */
  {
    slug: "set-curated-wall",
    name: "The Curated Wall",
    kind: "SET",
    summary: "A sculptural white niche wall — dramatic and editorial.",
    tiers: [
      { minutes: 15, includes: "1 outfit · 4 photos", naira: 30_000 },
      { minutes: 30, includes: "2 outfits · 8 photos", naira: 55_000 },
    ],
  },
  {
    slug: "set-curated-cove",
    name: "The Curated Cove",
    kind: "SET",
    summary: "Arched alcoves and soft lighting — calm, luxurious.",
    tiers: [
      { minutes: 15, includes: "1 outfit · 4 photos", naira: 30_000 },
      { minutes: 30, includes: "2 outfits · 8 photos", naira: 55_000 },
    ],
  },
  {
    slug: "set-arched-retreat",
    name: "The Arched Retreat",
    kind: "SET",
    summary: "Warm golden arches — intimate and dreamy.",
    tiers: [
      { minutes: 15, includes: "1 outfit · 4 photos", naira: 30_000 },
      { minutes: 30, includes: "2 outfits · 8 photos", naira: 45_000 },
    ],
  },
  {
    slug: "set-aurora-wave",
    name: "Aurora Wave",
    kind: "SET",
    summary: "LED-lit floating shelves on a cloud-blue wall.",
    tiers: [
      { minutes: 15, includes: "1 outfit · 4 photos", naira: 25_000 },
      { minutes: 30, includes: "2 outfits · 8 photos", naira: 55_000 },
    ],
  },

  /* ---------------- Booths (space rental) ---------------- */
  {
    slug: "booth-swing-attitude",
    name: "Swing Attitude",
    kind: "BOOTH",
    summary: "Orange swing booth with cloud canopy.",
    tiers: [
      { minutes: 15, includes: "Booth hire · bring your own camera or phone", naira: 15_000 },
      { minutes: 30, includes: "Booth hire · bring your own camera or phone", naira: 25_000 },
      { minutes: 60, includes: "Booth hire · bring your own camera or phone", naira: 45_000 },
    ],
  },
  {
    slug: "booth-odogwu-vibes",
    name: "Odogwu Vibes",
    kind: "BOOTH",
    summary: "Bold typographic backdrop — boss energy.",
    tiers: [
      { minutes: 15, includes: "Booth hire · bring your own camera or phone", naira: 15_000 },
      { minutes: 30, includes: "Booth hire · bring your own camera or phone", naira: 25_000 },
      { minutes: 60, includes: "Booth hire · bring your own camera or phone", naira: 45_000 },
    ],
  },
  {
    slug: "booth-lets-party",
    name: "Let's Party Booth",
    kind: "BOOTH",
    summary: "Neon nights, vinyl walls and a checkerboard floor.",
    tiers: [
      { minutes: 15, includes: "Booth hire · bring your own camera or phone", naira: 15_000 },
      { minutes: 30, includes: "Booth hire · bring your own camera or phone", naira: 25_000 },
      { minutes: 60, includes: "Booth hire · bring your own camera or phone", naira: 45_000 },
    ],
  },
  {
    slug: "booth-telephone",
    name: "Telephone Booth",
    kind: "BOOTH",
    summary: "Iconic cream telephone box — timeless and fun.",
    tiers: [
      { minutes: 15, includes: "Booth hire · bring your own camera or phone", naira: 15_000 },
      { minutes: 30, includes: "Booth hire · bring your own camera or phone", naira: 25_000 },
      { minutes: 60, includes: "Booth hire · bring your own camera or phone", naira: 45_000 },
    ],
  },

  /* ---------------- Backdrops (space rental) ---------------- */
  {
    slug: "backdrop-curated-wall",
    name: "The Curated Wall",
    kind: "BACKDROP",
    summary: "Premium sculptural niche wall rental.",
    tiers: [
      { minutes: 20, includes: "Backdrop hire · bring your own photographer", naira: 25_000 },
      { minutes: 60, includes: "Backdrop hire · bring your own photographer", naira: 50_000 },
    ],
  },
  {
    slug: "backdrop-curated-cove",
    name: "The Curated Cove",
    kind: "BACKDROP",
    summary: "Arched alcove backdrop rental.",
    tiers: [
      { minutes: 20, includes: "Backdrop hire · bring your own photographer", naira: 25_000 },
      { minutes: 60, includes: "Backdrop hire · bring your own photographer", naira: 50_000 },
    ],
  },
  {
    slug: "backdrop-arched-retreat",
    name: "The Arched Retreat",
    kind: "BACKDROP",
    summary: "Golden arch backdrop rental.",
    tiers: [
      { minutes: 20, includes: "Backdrop hire · bring your own photographer", naira: 20_000 },
      { minutes: 60, includes: "Backdrop hire · bring your own photographer", naira: 45_000 },
    ],
  },
  {
    slug: "backdrop-aurora-wave",
    name: "Aurora Wave",
    kind: "BACKDROP",
    summary: "LED floating-shelf backdrop rental.",
    tiers: [
      { minutes: 20, includes: "Backdrop hire · bring your own photographer", naira: 25_000 },
      { minutes: 60, includes: "Backdrop hire · bring your own photographer", naira: 50_000 },
    ],
  },

  /* ---------------- Studio rental ---------------- */
  {
    slug: "space-rental",
    name: "Studio Space Rental",
    kind: "RENTAL",
    summary: "Hourly hire of the studio, lighting and backdrops for photographers and brands.",
    tiers: [{ minutes: 60, includes: "Full studio · lighting · backdrops · props", naira: 40_000 }],
  },
];

function deliverablesFromIncludes(includes: string): {
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

function toService(seed: Seed, index: number): PublicService {
  const packages: PublicPackage[] = seed.tiers.map((tier, tierIndex) => {
    const parsed = deliverablesFromIncludes(tier.includes);
    return {
      id: `${seed.slug}-${tier.minutes}`,
      name:
        parsed.outfitCount != null
          ? parsed.outfitCount === 1
            ? "1 outfit"
            : `${parsed.outfitCount} outfits`
          : `${seed.name} · ${tier.minutes} min`,
      durationMinutes: tier.minutes,
      outfitCount: parsed.outfitCount,
      backdropCount: parsed.backdropCount,
      editedPhotoCount: parsed.editedPhotoCount,
      includes: tier.includes,
      priceKobo: tier.naira * 100,
      isProvisional: true,
      sortOrder: tierIndex,
    };
  });
  const startingPriceKobo = Math.min(...packages.map((pkg) => pkg.priceKobo));
  return {
    id: seed.slug,
    slug: seed.slug,
    name: seed.name,
    kind: seed.kind,
    summary: seed.summary,
    description: seed.description ?? (seed.note ? `${seed.summary} ${seed.note}` : seed.summary),
    startingPriceKobo,
    isProvisional: true,
    sortOrder: index,
    packages,
  };
}

export const fallbackServices: PublicService[] = seeds.map(toService);

/** Old-site "What would you like to book?" option list, grouped, for the contact form. */
export const enquirySessionTypes: { group: string; options: string[] }[] = [
  {
    group: "Photography sessions",
    options: [
      "Personal / Birthday Shoots",
      "Pre-Wedding / Couples Shoot",
      "Family Shoot",
      "Corporate Headshots",
      "Maternity Shoot",
      "Bundle of Joy (0–1 Year)",
      "Bundle of Joy (2–6 Years)",
      "Teens Shoot (7–15 Years)",
    ],
  },
  {
    group: "Aesthetic background sessions",
    options: ["The Curated Wall", "The Curated Cove", "The Arched Retreat", "Aurora Wave"],
  },
  {
    group: "Space rental",
    options: [
      "Space Rental — Swing Attitude",
      "Space Rental — Odogwu Vibes",
      "Space Rental — Let's Party Booth",
      "Space Rental — Telephone Booth",
      "Space Rental — Curated Wall Backdrop",
      "Space Rental — Curated Cove Backdrop",
      "Space Rental — Arched Retreat Backdrop",
      "Space Rental — Aurora Wave Backdrop",
      "Studio Space Rental (hourly)",
    ],
  },
];

export function formatNairaFromKobo(kobo: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(kobo / 100);
}

