import { mediaUrl } from "../lib/publicApi";

/**
 * Old-site stills keyed by catalogue slug. Display only — not pricing or availability.
 */
export const homePreviewImages: Record<string, string> = {
  "personal-birthday-corporate": "/media/home/personal-birthday-corporate.jpg",
  "bundle-of-joy": "/media/home/bundle-of-joy.jpg",
  "pre-wedding": "/media/home/pre-wedding.jpg",
  "space-rental": "/media/home/space-rental.jpg",
};

const FILES = {
  personalBirthday: "/media/bookings/personal-birthday.jpg",
  preWedding: "/media/bookings/pre-wedding.jpg",
  family: "/media/bookings/family.jpg",
  corporate: "/media/bookings/corporate.jpg",
  maternity: "/media/bookings/maternity.jpg",
  bundle01: "/media/bookings/bundle-of-joy-0-1.jpg",
  bundle26: "/media/bookings/bundle-of-joy-2-6.jpg",
  teens: "/media/bookings/teens-7-15.jpg",
  videoReels: "/media/bookings/video-reels.jpg",
  curatedWall: "/media/sets/curated-wall.jpg",
  curatedCove: "/media/sets/curated-cove.jpg",
  archedRetreat: "/media/sets/arched-retreat.jpg",
  auroraWave: "/media/sets/aurora-wave.jpg",
  swingAttitude: "/media/booths/swing-attitude.jpg",
  odogwuVibes: "/media/booths/odogwu-vibes.jpg",
  letsParty: "/media/booths/lets-party.jpg",
  telephone: "/media/booths/telephone.jpg",
  spaceRental: "/media/home/space-rental.jpg",
} as const;

/**
 * Seed slugs plus offline-fallback aliases. Same photograph is reused for a set
 * and its backdrop hire, matching the old Bookings page.
 */
const serviceSlugImages: Record<string, string> = {
  "personal-birthday": FILES.personalBirthday,
  "personal-birthday-shoots": FILES.personalBirthday,
  "pre-wedding": FILES.preWedding,
  "pre-wedding-couples": FILES.preWedding,
  family: FILES.family,
  "family-shoots": FILES.family,
  corporate: FILES.corporate,
  "corporate-headshots": FILES.corporate,
  maternity: FILES.maternity,
  "maternity-shoots": FILES.maternity,
  "bundle-of-joy-0-1": FILES.bundle01,
  "bundle-of-joy-0-1-year": FILES.bundle01,
  "bundle-of-joy-2-6": FILES.bundle26,
  "bundle-of-joy-2-6-years": FILES.bundle26,
  "teens-7-15": FILES.teens,
  "teens-shoot-7-15-years": FILES.teens,
  teens: FILES.teens,
  "video-reels": FILES.videoReels,
  "studio-video-coverage": FILES.videoReels,
  "the-curated-wardrobe": FILES.personalBirthday,
  "curated-wardrobe": FILES.personalBirthday,

  "set-curated-wall": FILES.curatedWall,
  "curated-wall": FILES.curatedWall,
  "the-curated-wall": FILES.curatedWall,
  "set-curated-cove": FILES.curatedCove,
  "curated-cove": FILES.curatedCove,
  "the-curated-cove": FILES.curatedCove,
  "set-arched-retreat": FILES.archedRetreat,
  "arched-retreat": FILES.archedRetreat,
  "the-arched-retreat": FILES.archedRetreat,
  "set-aurora-wave": FILES.auroraWave,
  "aurora-wave": FILES.auroraWave,

  "booth-swing-attitude": FILES.swingAttitude,
  "swing-attitude": FILES.swingAttitude,
  "booth-odogwu-vibes": FILES.odogwuVibes,
  "odogwu-vibes": FILES.odogwuVibes,
  "booth-lets-party": FILES.letsParty,
  "lets-party-booth": FILES.letsParty,
  "lets-party": FILES.letsParty,
  "booth-telephone": FILES.telephone,
  "telephone-booth": FILES.telephone,

  "backdrop-curated-wall": FILES.curatedWall,
  "curated-wall-backdrop": FILES.curatedWall,
  "backdrop-curated-cove": FILES.curatedCove,
  "curated-cove-backdrop": FILES.curatedCove,
  "backdrop-arched-retreat": FILES.archedRetreat,
  "arched-retreat-backdrop": FILES.archedRetreat,
  "backdrop-aurora-wave": FILES.auroraWave,
  "aurora-wave-backdrop": FILES.auroraWave,

  "space-rental": FILES.spaceRental,
  "studio-rental": FILES.spaceRental,
  "studio-space-rental": FILES.spaceRental,
};

const serviceNameImages: Record<string, string> = {
  "personal birthday shoots": FILES.personalBirthday,
  "personal birthday": FILES.personalBirthday,
  "pre wedding couples": FILES.preWedding,
  "pre wedding": FILES.preWedding,
  "family shoots": FILES.family,
  family: FILES.family,
  "corporate headshots": FILES.corporate,
  corporate: FILES.corporate,
  "maternity shoots": FILES.maternity,
  maternity: FILES.maternity,
  "bundle of joy 0 1 year": FILES.bundle01,
  "bundle of joy 0 1": FILES.bundle01,
  "bundle of joy 2 6 years": FILES.bundle26,
  "bundle of joy 2 6": FILES.bundle26,
  "teens shoot 7 15 years": FILES.teens,
  "teens shoot": FILES.teens,
  teens: FILES.teens,
  "studio video coverage": FILES.videoReels,
  "video reels": FILES.videoReels,
  "the curated wardrobe": FILES.personalBirthday,
  "curated wardrobe": FILES.personalBirthday,
  "the curated wall": FILES.curatedWall,
  "the curated cove": FILES.curatedCove,
  "the arched retreat": FILES.archedRetreat,
  "aurora wave": FILES.auroraWave,
  "swing attitude": FILES.swingAttitude,
  "odogwu vibes": FILES.odogwuVibes,
  "lets party booth": FILES.letsParty,
  "telephone booth": FILES.telephone,
  "studio space rental": FILES.spaceRental,
  "space rental": FILES.spaceRental,
};

function normalizeServiceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[·•–—]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function mediaForServiceSlug(slug: string): string | undefined {
  return serviceSlugImages[slug];
}

function mediaForServiceName(name: string | null | undefined): string | undefined {
  if (!name?.trim()) return undefined;
  return serviceNameImages[normalizeServiceName(name)];
}

/** CMS media wins; otherwise the existing slug / name fallback. */
export function serviceHeroSrc(service: {
  slug?: string | null;
  name?: string | null;
  media?: { url?: string | null; thumbUrl?: string | null } | null;
}): string | undefined {
  const cms = (service.media?.thumbUrl || service.media?.url)?.trim();
  if (cms) return mediaUrl(cms) || undefined;
  if (service.slug) {
    const fromSlug = mediaForServiceSlug(service.slug);
    if (fromSlug) return fromSlug;
  }
  return mediaForServiceName(service.name);
}

export const aboutStudioImage = "/media/about.jpg";
export const servicesHeroImage = "/media/services-header-banner.jpg";
