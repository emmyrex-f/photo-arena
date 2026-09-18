import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  buildSeedSettings,
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
      data: { email, passwordHash, name, role: Role.OWNER, isActive: true },
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
      const name = `${service.name} ${tier.durationMinutes} min`;
      const existing = await prisma.package.findFirst({
        where: { serviceId: saved.id, durationMinutes: tier.durationMinutes },
      });
      if (existing) {
        await prisma.package.update({
          where: { id: existing.id },
          data: {
            name,
            includes,
            priceKobo: tier.priceKobo,
            isActive: true,
            isProvisional: true,
            sortOrder: packageOrder,
          },
        });
      } else {
        await prisma.package.create({
          data: {
            serviceId: saved.id,
            name,
            durationMinutes: tier.durationMinutes,
            includes,
            priceKobo: tier.priceKobo,
            isActive: true,
            isProvisional: true,
            sortOrder: packageOrder,
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
