import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  buildSeedSettings,
  deliverablesFromIncludes,
  legacySettingKeys,
  seedFaqs,
  seedGallery,
  seedServices,
  seedTestimonials,
} from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_OWNER_EMAIL ?? "owner@photoarenang.com").trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD ?? "changeme";
  const name = process.env.SEED_OWNER_NAME ?? "Photo Arena Owner";

  const existingOwner = await prisma.user.findUnique({ where: { email } });
  if (!existingOwner) {
    const passwordHash = await hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: Role.OWNER,
        isActive: true,
        permissions: ["*"],
      },
    });
  } else {
    await prisma.user.update({ where: { email }, data: { name } });
  }

  await prisma.studioResource.upsert({
    where: { id: "main-studio" },
    create: { id: "main-studio", name: "Main Studio", isActive: true },
    update: { name: "Main Studio", isActive: true },
  });

  if (!(await prisma.pricingRule.findUnique({ where: { key: "ONLINE_DISCOUNT" } }))) {
    await prisma.pricingRule.create({ data: { key: "ONLINE_DISCOUNT", bps: 500, isActive: true } });
  }
  if (!(await prisma.pricingRule.findUnique({ where: { key: "RESCHEDULE_FEE" } }))) {
    await prisma.pricingRule.create({ data: { key: "RESCHEDULE_FEE", bps: 1500, isActive: true } });
  }

  for (const key of legacySettingKeys) {
    await prisma.businessSettings.deleteMany({ where: { key } });
  }

  const settings = buildSeedSettings(process.env);
  for (const [key, value] of Object.entries(settings)) {
    await prisma.businessSettings.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  let serviceOrder = 0;
  for (const service of seedServices) {
    const startingPriceKobo = Math.min(...service.tiers.map((t) => t.priceKobo));
    const saved = await prisma.service.upsert({
      where: { slug: service.slug },
      create: {
        slug: service.slug,
        name: service.name,
        kind: service.kind,
        summary: service.summary,
        description: service.description,
        startingPriceKobo,
        isActive: true,
        isProvisional: true,
        sortOrder: serviceOrder,
      },
      update: {
        name: service.name,
        kind: service.kind,
        summary: service.summary,
        description: service.description,
        startingPriceKobo,
        isActive: true,
        isProvisional: true,
        sortOrder: serviceOrder,
      },
    });

    let packageOrder = 0;
    for (const tier of service.tiers) {
      const includes = tier.note ? `${tier.includes} · ${tier.note}` : tier.includes;
      const parsed = deliverablesFromIncludes(includes);
      const name =
        parsed.outfitCount != null
          ? parsed.outfitCount === 1
            ? "1 outfit"
            : `${parsed.outfitCount} outfits`
          : `${tier.durationMinutes} min`;
      const existing = await prisma.package.findFirst({
        where: { serviceId: saved.id, durationMinutes: tier.durationMinutes },
      });
      const packageFields = {
        name,
        includes,
        durationMinutes: tier.durationMinutes,
        outfitCount: parsed.outfitCount,
        backdropCount: parsed.backdropCount,
        editedPhotoCount: parsed.editedPhotoCount,
        priceKobo: tier.priceKobo,
        isActive: true,
        isProvisional: true,
        sortOrder: packageOrder,
      };
      if (existing) {
        await prisma.package.update({
          where: { id: existing.id },
          data: packageFields,
        });
      } else {
        await prisma.package.create({
          data: {
            serviceId: saved.id,
            ...packageFields,
          },
        });
      }
      packageOrder += 1;
    }
    serviceOrder += 1;
  }

  let faqOrder = 0;
  for (const faq of seedFaqs) {
    const existing = await prisma.faq.findFirst({ where: { question: faq.question } });
    if (existing) {
      await prisma.faq.update({
        where: { id: existing.id },
        data: { answer: faq.answer, sortOrder: faqOrder, isActive: true },
      });
    } else {
      await prisma.faq.create({
        data: {
          question: faq.question,
          answer: faq.answer,
          sortOrder: faqOrder,
          isActive: true,
        },
      });
    }
    faqOrder += 1;
  }

  let testimonialOrder = 0;
  for (const t of seedTestimonials) {
    const existing = await prisma.testimonial.findFirst({
      where: { name: t.name, quote: t.quote },
    });
    if (existing) {
      await prisma.testimonial.update({
        where: { id: existing.id },
        data: {
          role: t.role,
          rating: t.rating,
          isPublished: false,
          sortOrder: testimonialOrder,
        },
      });
    } else {
      await prisma.testimonial.create({
        data: {
          quote: t.quote,
          name: t.name,
          role: t.role,
          rating: t.rating,
          isPublished: false,
          sortOrder: testimonialOrder,
        },
      });
    }
    testimonialOrder += 1;
  }

  let galleryOrder = 0;
  for (const img of seedGallery) {
    await prisma.galleryImage.upsert({
      where: { id: img.id },
      create: {
        id: img.id,
        filename: img.file,
        url: `/gallery/${img.file}`,
        thumbUrl: `/gallery/${img.file}`,
        kind: "GALLERY",
        category: img.category,
        alt: img.alt,
        featured: img.featured,
        isActive: true,
        sortOrder: galleryOrder,
      },
      update: {
        filename: img.file,
        url: `/gallery/${img.file}`,
        thumbUrl: `/gallery/${img.file}`,
        kind: "GALLERY",
        category: img.category,
        alt: img.alt,
        featured: img.featured,
        isActive: true,
        sortOrder: galleryOrder,
      },
    });
    galleryOrder += 1;
  }

  // Seed Service Media and Attach MediaUsages
  const serviceMediaMap: Record<string, { url: string; alt: string; category: string; filename: string }> = {
    "personal-birthday": { url: "/media/bookings/personal-birthday.jpg", alt: "Personal & Birthday Shoots", category: "sessions", filename: "personal-birthday.jpg" },
    "pre-wedding": { url: "/media/bookings/pre-wedding.jpg", alt: "Pre-Wedding & Couples Shoots", category: "sessions", filename: "pre-wedding.jpg" },
    "family": { url: "/media/bookings/family.jpg", alt: "Family Shoots", category: "sessions", filename: "family.jpg" },
    "corporate": { url: "/media/bookings/corporate.jpg", alt: "Corporate Headshots", category: "sessions", filename: "corporate.jpg" },
    "maternity": { url: "/media/bookings/maternity.jpg", alt: "Maternity Shoots", category: "sessions", filename: "maternity.jpg" },
    "bundle-of-joy-0-1": { url: "/media/bookings/bundle-of-joy-0-1.jpg", alt: "Bundle of Joy · 0–1 Year", category: "sessions", filename: "bundle-of-joy-0-1.jpg" },
    "bundle-of-joy-2-6": { url: "/media/bookings/bundle-of-joy-2-6.jpg", alt: "Bundle of Joy · 2–6 Years", category: "sessions", filename: "bundle-of-joy-2-6.jpg" },
    "teens-7-15": { url: "/media/bookings/teens-7-15.jpg", alt: "Teens Shoot · 7–15 Years", category: "sessions", filename: "teens-7-15.jpg" },
    "video-reels": { url: "/media/bookings/video-reels.jpg", alt: "Studio Video Content Sessions", category: "sessions", filename: "video-reels.jpg" },
    "set-curated-wall": { url: "/media/sets/curated-wall.jpg", alt: "The Curated Wall", category: "sets", filename: "curated-wall.jpg" },
    "set-curated-cove": { url: "/media/sets/curated-cove.jpg", alt: "The Curated Cove", category: "sets", filename: "curated-cove.jpg" },
    "set-arched-retreat": { url: "/media/sets/arched-retreat.jpg", alt: "The Arched Retreat", category: "sets", filename: "arched-retreat.jpg" },
    "set-aurora-wave": { url: "/media/sets/aurora-wave.jpg", alt: "Aurora Wave", category: "sets", filename: "aurora-wave.jpg" },
    "booth-swing-attitude": { url: "/media/booths/swing-attitude.jpg", alt: "Swing Attitude", category: "booths", filename: "swing-attitude.jpg" },
    "booth-odogwu-vibes": { url: "/media/booths/odogwu-vibes.jpg", alt: "Odogwu Vibes", category: "booths", filename: "odogwu-vibes.jpg" },
    "booth-lets-party": { url: "/media/booths/lets-party.jpg", alt: "Let's Party Booth", category: "booths", filename: "lets-party.jpg" },
    "booth-telephone": { url: "/media/booths/telephone.jpg", alt: "Telephone Booth", category: "booths", filename: "telephone.jpg" },
    "backdrop-curated-wall": { url: "/media/sets/curated-wall.jpg", alt: "The Curated Wall (Backdrop Rental)", category: "backdrops", filename: "curated-wall.jpg" },
    "backdrop-curated-cove": { url: "/media/sets/curated-cove.jpg", alt: "The Curated Cove (Backdrop Rental)", category: "backdrops", filename: "curated-cove.jpg" },
    "backdrop-arched-retreat": { url: "/media/sets/arched-retreat.jpg", alt: "The Arched Retreat (Backdrop Rental)", category: "backdrops", filename: "arched-retreat.jpg" },
    "backdrop-aurora-wave": { url: "/media/sets/aurora-wave.jpg", alt: "Aurora Wave (Backdrop Rental)", category: "backdrops", filename: "aurora-wave.jpg" },
    "space-rental": { url: "/media/home/space-rental.jpg", alt: "Studio Space Rental", category: "rentals", filename: "space-rental.jpg" },
  };

  for (const [slug, meta] of Object.entries(serviceMediaMap)) {
    const svc = await prisma.service.findUnique({ where: { slug } });
    const category = svc ? `Service/${svc.name}` : meta.category;
    let img = await prisma.galleryImage.findFirst({ where: { url: meta.url } });
    if (!img) {
      img = await prisma.galleryImage.create({
        data: {
          url: meta.url,
          thumbUrl: meta.url,
          alt: meta.alt,
          category,
          filename: meta.filename,
          kind: "CONTENT",
          isActive: true,
        },
      });
    } else {
      await prisma.galleryImage.update({
        where: { id: img.id },
        data: { category },
      });
    }
    if (svc) {
      const usage = await prisma.mediaUsage.findFirst({
        where: { entityId: svc.id, usageType: "service" },
      });
      if (!usage) {
        await prisma.mediaUsage.create({
          data: { entityId: svc.id, usageType: "service", mediaId: img.id, sortOrder: 0 },
        });
      }
    }
  }

  console.log(
    `Seeded OWNER ${email}; ${seedServices.length} services; ${seedFaqs.length} FAQs; ${seedTestimonials.length} unpublished testimonials; ${seedGallery.length} gallery images; settings keys=${Object.keys(settings).length}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
