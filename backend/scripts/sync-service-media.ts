import { PrismaClient, MediaKind } from "@prisma/client";

const prisma = new PrismaClient();

const SERVICE_MEDIA_DEFINITIONS: Array<{
  slug: string;
  url: string;
  alt: string;
  category: string;
  filename: string;
}> = [
  {
    slug: "personal-birthday",
    url: "/media/bookings/personal-birthday.jpg",
    alt: "Personal & Birthday Shoots",
    category: "sessions",
    filename: "personal-birthday.jpg",
  },
  {
    slug: "pre-wedding",
    url: "/media/bookings/pre-wedding.jpg",
    alt: "Pre-Wedding & Couples Shoots",
    category: "sessions",
    filename: "pre-wedding.jpg",
  },
  {
    slug: "family",
    url: "/media/bookings/family.jpg",
    alt: "Family Shoots",
    category: "sessions",
    filename: "family.jpg",
  },
  {
    slug: "corporate",
    url: "/media/bookings/corporate.jpg",
    alt: "Corporate Headshots",
    category: "sessions",
    filename: "corporate.jpg",
  },
  {
    slug: "maternity",
    url: "/media/bookings/maternity.jpg",
    alt: "Maternity Shoots",
    category: "sessions",
    filename: "maternity.jpg",
  },
  {
    slug: "bundle-of-joy-0-1",
    url: "/media/bookings/bundle-of-joy-0-1.jpg",
    alt: "Bundle of Joy · 0–1 Year",
    category: "sessions",
    filename: "bundle-of-joy-0-1.jpg",
  },
  {
    slug: "bundle-of-joy-2-6",
    url: "/media/bookings/bundle-of-joy-2-6.jpg",
    alt: "Bundle of Joy · 2–6 Years",
    category: "sessions",
    filename: "bundle-of-joy-2-6.jpg",
  },
  {
    slug: "teens-7-15",
    url: "/media/bookings/teens-7-15.jpg",
    alt: "Teens Shoot · 7–15 Years",
    category: "sessions",
    filename: "teens-7-15.jpg",
  },
  {
    slug: "video-reels",
    url: "/media/bookings/video-reels.jpg",
    alt: "Studio Video Content Sessions",
    category: "sessions",
    filename: "video-reels.jpg",
  },
  {
    slug: "set-curated-wall",
    url: "/media/sets/curated-wall.jpg",
    alt: "The Curated Wall",
    category: "sets",
    filename: "curated-wall.jpg",
  },
  {
    slug: "set-curated-cove",
    url: "/media/sets/curated-cove.jpg",
    alt: "The Curated Cove",
    category: "sets",
    filename: "curated-cove.jpg",
  },
  {
    slug: "set-arched-retreat",
    url: "/media/sets/arched-retreat.jpg",
    alt: "The Arched Retreat",
    category: "sets",
    filename: "arched-retreat.jpg",
  },
  {
    slug: "set-aurora-wave",
    url: "/media/sets/aurora-wave.jpg",
    alt: "Aurora Wave",
    category: "sets",
    filename: "aurora-wave.jpg",
  },
  {
    slug: "booth-swing-attitude",
    url: "/media/booths/swing-attitude.jpg",
    alt: "Swing Attitude",
    category: "booths",
    filename: "swing-attitude.jpg",
  },
  {
    slug: "booth-odogwu-vibes",
    url: "/media/booths/odogwu-vibes.jpg",
    alt: "Odogwu Vibes",
    category: "booths",
    filename: "odogwu-vibes.jpg",
  },
  {
    slug: "booth-lets-party",
    url: "/media/booths/lets-party.jpg",
    alt: "Let's Party Booth",
    category: "booths",
    filename: "lets-party.jpg",
  },
  {
    slug: "booth-telephone",
    url: "/media/booths/telephone.jpg",
    alt: "Telephone Booth",
    category: "booths",
    filename: "telephone.jpg",
  },
  {
    slug: "backdrop-curated-wall",
    url: "/media/sets/curated-wall.jpg",
    alt: "The Curated Wall (Backdrop Rental)",
    category: "backdrops",
    filename: "curated-wall.jpg",
  },
  {
    slug: "backdrop-curated-cove",
    url: "/media/sets/curated-cove.jpg",
    alt: "The Curated Cove (Backdrop Rental)",
    category: "backdrops",
    filename: "curated-cove.jpg",
  },
  {
    slug: "backdrop-arched-retreat",
    url: "/media/sets/arched-retreat.jpg",
    alt: "The Arched Retreat (Backdrop Rental)",
    category: "backdrops",
    filename: "arched-retreat.jpg",
  },
  {
    slug: "backdrop-aurora-wave",
    url: "/media/sets/aurora-wave.jpg",
    alt: "Aurora Wave (Backdrop Rental)",
    category: "backdrops",
    filename: "aurora-wave.jpg",
  },
  {
    slug: "space-rental",
    url: "/media/home/space-rental.jpg",
    alt: "Studio Space Rental",
    category: "rentals",
    filename: "space-rental.jpg",
  },
];

const ADDITIONAL_WEBSITE_MEDIA: Array<{
  url: string;
  alt: string;
  category: string;
  filename: string;
}> = [
  {
    url: "/media/hero-landscape.jpg",
    alt: "Hero Studio Landscape Banner",
    category: "banners",
    filename: "hero-landscape.jpg",
  },
  {
    url: "/media/hero-camera.jpg",
    alt: "Hero Camera Close-up",
    category: "banners",
    filename: "hero-camera.jpg",
  },
  {
    url: "/media/about.jpg",
    alt: "About Studio Story Image",
    category: "content",
    filename: "about.jpg",
  },
  {
    url: "/media/services-header-banner.jpg",
    alt: "Services Header Banner",
    category: "banners",
    filename: "services-header-banner.jpg",
  },
  {
    url: "/media/about-header-banner.jpg",
    alt: "About Header Banner",
    category: "banners",
    filename: "about-header-banner.jpg",
  },
  {
    url: "/media/book-header-banner.jpg",
    alt: "Book Header Banner",
    category: "banners",
    filename: "book-header-banner.jpg",
  },
  {
    url: "/media/contact-header-banner.jpg",
    alt: "Contact Header Banner",
    category: "banners",
    filename: "contact-header-banner.jpg",
  },
  {
    url: "/media/faq-header-banner.jpg",
    alt: "FAQ Header Banner",
    category: "banners",
    filename: "faq-header-banner.jpg",
  },
  {
    url: "/media/portfolio-header-banner.jpg",
    alt: "Portfolio Header Banner",
    category: "banners",
    filename: "portfolio-header-banner.jpg",
  },
];

async function sync() {
  console.log("Starting service media sync...");

  // 1. Ensure all service media are in GalleryImage
  for (const def of SERVICE_MEDIA_DEFINITIONS) {
    let image = await prisma.galleryImage.findFirst({
      where: { url: def.url },
    });

    if (!image) {
      image = await prisma.galleryImage.create({
        data: {
          url: def.url,
          thumbUrl: def.url,
          alt: def.alt,
          category: def.category,
          filename: def.filename,
          kind: MediaKind.CONTENT,
          isActive: true,
        },
      });
      console.log(`Created GalleryImage for ${def.url} (${image.id})`);
    } else {
      console.log(`Found existing GalleryImage for ${def.url} (${image.id})`);
    }

    // 2. Find service by slug
    const service = await prisma.service.findUnique({
      where: { slug: def.slug },
    });

    if (!service) {
      console.warn(`Warning: Service with slug "${def.slug}" not found in database!`);
      continue;
    }

    // 3. Attach or update MediaUsage
    const existingUsage = await prisma.mediaUsage.findFirst({
      where: {
        entityId: service.id,
        usageType: "service",
      },
    });

    if (!existingUsage) {
      await prisma.mediaUsage.create({
        data: {
          entityId: service.id,
          usageType: "service",
          mediaId: image.id,
          sortOrder: 0,
        },
      });
      console.log(`Attached media ${image.id} to service "${service.name}" (${service.slug})`);
    } else if (existingUsage.mediaId !== image.id) {
      await prisma.mediaUsage.update({
        where: { id: existingUsage.id },
        data: { mediaId: image.id },
      });
      console.log(`Updated media usage for service "${service.name}" to ${image.id}`);
    } else {
      console.log(`Service "${service.name}" already has correct media usage attached.`);
    }
  }

  // 4. Ensure additional website media are in GalleryImage
  for (const extra of ADDITIONAL_WEBSITE_MEDIA) {
    const exists = await prisma.galleryImage.findFirst({
      where: { url: extra.url },
    });
    if (!exists) {
      await prisma.galleryImage.create({
        data: {
          url: extra.url,
          thumbUrl: extra.url,
          alt: extra.alt,
          category: extra.category,
          filename: extra.filename,
          kind: MediaKind.CONTENT,
          isActive: true,
        },
      });
      console.log(`Created additional website media: ${extra.url}`);
    }
  }

  console.log("Sync complete!");
}

sync()
  .catch((err) => {
    console.error("Sync error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
