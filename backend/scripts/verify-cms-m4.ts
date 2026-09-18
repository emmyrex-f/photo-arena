/**
 * M4 CMS chain: Admin API → PostgreSQL → public API.
 * Restores approved catalogue values. Does not switch Bachs to mock.
 */
import "./load-env";
import assert from "node:assert/strict";
import { PrismaClient, Role } from "@prisma/client";
import sharp from "sharp";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");
const prisma = new PrismaClient();

type Json = Record<string, unknown>;

async function api<T = Json>(
  method: string,
  path: string,
  opts?: { body?: unknown; token?: string; form?: FormData },
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {};
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: opts?.form ? opts.form : opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await response.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = { raw: text } as T;
  }
  return { status: response.status, data };
}

function lagosDateOffset(days: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + days * 86_400_000));
}

async function main() {
  console.log(`M4 CMS verify → ${API_BASE}`);

  const unauth = await api("PUT", "/admin/settings", { body: { "site.name": "Nope" } });
  assert.equal(unauth.status, 401, `unauthenticated settings PUT ${unauth.status}`);
  console.log("Unauthenticated settings mutation rejected ✓");

  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? "owner@photoarenang.com").trim().toLowerCase();
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme";
  const login = await api<{ token: string }>("POST", "/auth/login", {
    body: { email: ownerEmail, password: ownerPassword },
  });
  assert.ok(login.status < 300 && login.data.token, `owner login ${login.status}`);
  const token = login.data.token;

  const staffEmail = `m4-staff-${Date.now()}@photoarenang.com`;
  const staffPass = "StaffPass12";
  const createdStaff = await api<{ id: string }>("POST", "/admin/users", {
    token,
    body: { email: staffEmail, name: "M4 Staff", role: "STAFF", password: staffPass },
  });
  assert.ok(createdStaff.status < 300, `create staff ${createdStaff.status}`);
    const staffLogin = await api<{ token: string }>("POST", "/auth/login", {
    body: { email: ownerEmail, password: staffPass },
  });
  assert.ok(staffLogin.status < 300, `staff login ${staffLogin.status}`);
  const staffPut = await api("PUT", "/admin/settings", {
    token: staffLogin.data.token,
    body: { "site.name": "Staff should not write" },
  });
  assert.equal(staffPut.status, 403, `staff settings PUT ${staffPut.status}`);
  await api("DELETE", `/admin/users/${createdStaff.data.id}`, { token });
  console.log("STAFF cannot mutate settings; OWNER can authenticate ✓");

  const hoursWeekday = "8:00 AM – 6:00 PM";
  const hoursSunday = "12:00 PM – 6:00 PM";
  const hoursWrite = await api("PUT", "/admin/settings", {
    token,
    body: {
      "site.hours.weekday": ` ${hoursWeekday} . `,
      "site.hours.sunday": ` ${hoursSunday} . `,
    },
  });
  assert.ok(hoursWrite.status < 300, `hours PUT ${hoursWrite.status}`);
  const hoursDb = await prisma.businessSettings.findMany({
    where: { key: { in: ["site.hours.weekday", "site.hours.sunday"] } },
  });
  const weekdayStored = hoursDb.find((r) => r.key === "site.hours.weekday")?.value;
  const sundayStored = hoursDb.find((r) => r.key === "site.hours.sunday")?.value;
  assert.equal(weekdayStored, hoursWeekday, `weekday stored ${weekdayStored}`);
  assert.equal(sundayStored, hoursSunday, `sunday stored ${sundayStored}`);
  const publicSettings = await api<Record<string, string>>("GET", "/public/settings");
  assert.equal(publicSettings.data["site.hours.weekday"], hoursWeekday);
  assert.equal(publicSettings.data["site.hours.sunday"], hoursSunday);
  assert.ok(publicSettings.data["site.phone"]);
  assert.ok(publicSettings.data["site.email"]);
  assert.ok(publicSettings.data["site.address"]);
  assert.ok(publicSettings.data["social.instagram"]?.includes("instagram.com"));
  assert.ok(publicSettings.data["hero.headline"]);
  console.log("Hours/contact settings Admin → DB → public API ✓");

  const service = await prisma.service.findFirst({
    where: { slug: "personal-birthday" },
    include: { packages: true },
  });
  assert.ok(service, "personal-birthday service missing");
  const hourPkg = service.packages.find((p) => p.durationMinutes === 60);
  assert.ok(hourPkg, "60 min personal-birthday package missing");
  const originalName = service.name;
  const originalPrice = hourPkg.priceKobo;
  assert.equal(originalPrice, 5_500_000, `expected ₦55,000 studio price, got ${originalPrice}`);

  const renamed = await api("PATCH", `/admin/services/${service.id}`, {
    token,
    body: { name: "Personal & Birthday Sessions — TEST" },
  });
  assert.ok(renamed.status < 300, `rename ${renamed.status}`);
  const publicAfterName = await api<Array<{ id: string; name: string; slug: string }>>("GET", "/public/services");
  const named = publicAfterName.data.find((s) => s.slug === "personal-birthday");
  assert.equal(named?.name, "Personal & Birthday Sessions — TEST");
  await api("PATCH", `/admin/services/${service.id}`, { token, body: { name: originalName } });
  console.log("Service name Admin → DB → public API (restored) ✓");

  const priced = await api("PATCH", `/admin/packages/${hourPkg.id}`, {
    token,
    body: { priceKobo: 6_000_000 },
  });
  assert.ok(priced.status < 300, `price patch ${priced.status}`);
  const dbPriced = await prisma.package.findUnique({ where: { id: hourPkg.id } });
  assert.equal(dbPriced?.priceKobo, 6_000_000);
  const publicPriced = await api<
    Array<{
      slug: string;
      packages: Array<{ id: string; priceKobo: number; onlinePriceKobo: number; durationMinutes: number }>;
    }>
  >("GET", "/public/services");
  const pubPkg = publicPriced.data
    .find((s) => s.slug === "personal-birthday")
    ?.packages.find((p) => p.id === hourPkg.id);
  assert.equal(pubPkg?.priceKobo, 6_000_000);
  assert.equal(pubPkg?.onlinePriceKobo, 5_700_000, "5% of 60,000 should be 57,000");

  const discount = await api("PATCH", "/admin/pricing-rules/ONLINE_DISCOUNT", {
    token,
    body: { bps: 700 },
  });
  assert.ok(discount.status < 300, `discount patch ${discount.status}`);
  const ruleDb = await prisma.pricingRule.findUnique({ where: { key: "ONLINE_DISCOUNT" } });
  assert.equal(ruleDb?.bps, 700);
  const public7 = await api<
    Array<{
      slug: string;
      packages: Array<{ id: string; priceKobo: number; onlinePriceKobo: number; discountPercent: number }>;
    }>
  >("GET", "/public/services");
  const pkg7 = public7.data
    .find((s) => s.slug === "personal-birthday")
    ?.packages.find((p) => p.id === hourPkg.id);
  assert.equal(pkg7?.priceKobo, 6_000_000);
  assert.equal(pkg7?.discountPercent, 7);
  assert.equal(pkg7?.onlinePriceKobo, 5_580_000, "7% of 60,000 should be 55,800");

  await api("PATCH", "/admin/pricing-rules/ONLINE_DISCOUNT", { token, body: { bps: 500 } });
  await api("PATCH", `/admin/packages/${hourPkg.id}`, { token, body: { priceKobo: originalPrice } });
  const restoredPkg = await prisma.package.findUnique({ where: { id: hourPkg.id } });
  assert.equal(restoredPkg?.priceKobo, originalPrice);
  const restoredRule = await prisma.pricingRule.findUnique({ where: { key: "ONLINE_DISCOUNT" } });
  assert.equal(restoredRule?.bps, 500);
  console.log("Package price 55k→60k and discount 5%→7% verified and restored ✓");

  const testService = await api<{ id: string }>("POST", "/admin/services", {
    token,
    body: {
      name: "M4 CMS Test Service",
      slug: `m4-cms-test-${Date.now()}`,
      kind: "SESSION",
      summary: "Temporary M4 verification service",
      description: "Temporary M4 verification service — not a public offering.",
      startingPriceKobo: 1_000_000,
      isActive: true,
    },
  });
  assert.ok(testService.status < 300, `create service ${testService.status}`);
  const testPkg = await api<{ id: string }>("POST", `/admin/services/${testService.data.id}/packages`, {
    token,
    body: {
      name: "M4 30 min",
      durationMinutes: 30,
      includes: "M4 test package",
      priceKobo: 1_000_000,
      isActive: true,
    },
  });
  assert.ok(testPkg.status < 300, `create package ${testPkg.status}`);
  const publicWithTest = await api<Array<{ id: string }>>("GET", "/public/services");
  assert.ok(publicWithTest.data.some((s) => s.id === testService.data.id));
  await api("PATCH", `/admin/services/${testService.data.id}`, { token, body: { isActive: false } });
  const publicHidden = await api<Array<{ id: string }>>("GET", "/public/services");
  assert.ok(!publicHidden.data.some((s) => s.id === testService.data.id));
  await api("DELETE", `/admin/services/${testService.data.id}`, { token });
  console.log("Service create → public → deactivate → absent → delete ✓");

  const jpeg = await sharp({
    create: { width: 200, height: 200, channels: 3, background: { r: 32, g: 32, b: 36 } },
  })
    .jpeg()
    .toBuffer();
  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "m4-cms-test.jpg");
  form.append("kind", "GALLERY");
  form.append("category", "m4-test");
  form.append("alt", "M4 CMS TEST — not a client photograph");
  const uploaded = await api<Array<{ id: string; width: number; height: number; isActive?: boolean }>>(
    "POST",
    "/admin/gallery/upload",
    { token, form },
  );
  assert.ok(uploaded.status < 300 && uploaded.data[0]?.id, `upload ${uploaded.status}`);
  const imageId = uploaded.data[0]!.id;
  const publicGallery = await api<Array<{ id: string; alt: string; width: number | null }>>("GET", "/public/gallery");
  assert.ok(publicGallery.data.some((g) => g.id === imageId));
  const placeholders = publicGallery.data.filter(
    (g) => (g.width != null && g.width < 64) || false,
  );
  assert.equal(placeholders.length, 0, "public gallery must not include sub-64px items");
  await api("PATCH", `/admin/gallery/${imageId}`, { token, body: { isActive: false } });
  const unpublishedGallery = await api<Array<{ id: string }>>("GET", "/public/gallery");
  assert.ok(!unpublishedGallery.data.some((g) => g.id === imageId));
  const realPhotos = unpublishedGallery.data.filter((g) => !String(g.id).includes("never"));
  assert.ok(realPhotos.length >= 20, `expected existing portfolio photos, got ${realPhotos.length}`);
  await api("DELETE", `/admin/gallery/${imageId}`, { token });
  const eightByEight = await prisma.galleryImage.count({
    where: { OR: [{ width: { lt: 64 } }, { height: { lt: 64 } }] },
  });
  assert.ok(eightByEight >= 1, "8×8 placeholder rows must remain in the database");
  console.log("Gallery upload/publish/unpublish/delete; 8×8 rows kept ✓");

  const testimonial = await api<{ id: string }>("POST", "/admin/testimonials", {
    token,
    body: {
      quote: "M4 CMS TEST quote — not a client review.",
      name: "M4 Test Record",
      role: "Verification",
      isPublished: false,
    },
  });
  assert.ok(testimonial.status < 300, `testimonial create ${testimonial.status}`);
  const publicT0 = await api<Array<{ id: string }>>("GET", "/public/testimonials");
  assert.ok(!publicT0.data.some((t) => t.id === testimonial.data.id));
  await api("PATCH", `/admin/testimonials/${testimonial.data.id}`, { token, body: { isPublished: true } });
  const publicT1 = await api<Array<{ id: string }>>("GET", "/public/testimonials");
  assert.ok(publicT1.data.some((t) => t.id === testimonial.data.id));
  await api("PATCH", `/admin/testimonials/${testimonial.data.id}`, { token, body: { isPublished: false } });
  const publicT2 = await api<Array<{ id: string }>>("GET", "/public/testimonials");
  assert.ok(!publicT2.data.some((t) => t.id === testimonial.data.id));
  await api("DELETE", `/admin/testimonials/${testimonial.data.id}`, { token });
  console.log("Testimonial unpublished/published/unpublished/deleted ✓");

  const faq = await api<{ id: string }>("POST", "/admin/faqs", {
    token,
    body: {
      question: "M4 CMS TEST question?",
      answer: "Temporary verification FAQ — not studio copy.",
      isActive: false,
    },
  });
  assert.ok(faq.status < 300, `faq create ${faq.status}`);
  const publicFaq0 = await api<Array<{ id: string }>>("GET", "/public/faqs");
  assert.ok(!publicFaq0.data.some((f) => f.id === faq.data.id));
  await api("PATCH", `/admin/faqs/${faq.data.id}`, { token, body: { isActive: true } });
  const publicFaq1 = await api<Array<{ id: string }>>("GET", "/public/faqs");
  assert.ok(publicFaq1.data.some((f) => f.id === faq.data.id));
  await api("PATCH", `/admin/faqs/${faq.data.id}`, { token, body: { isActive: false } });
  await api("DELETE", `/admin/faqs/${faq.data.id}`, { token });
  console.log("FAQ create/publish/unpublish/delete ✓");

  const slug = `m4-cms-test-${Date.now()}`;
  const post = await api<{ id: string; slug: string }>("POST", "/admin/blog", {
    token,
    body: {
      title: "M4 CMS TEST post",
      slug,
      excerpt: "Temporary verification article.",
      content: "Temporary verification article — not studio journalism.",
      isPublished: false,
    },
  });
  assert.ok(post.status < 300, `blog create ${post.status}`);
  const unpublishedSlug = await api("GET", `/public/blog/${slug}`);
  assert.equal(unpublishedSlug.status, 404);
  await api("PATCH", `/admin/blog/${post.data.id}`, { token, body: { isPublished: true } });
  const publishedSlug = await api<{ slug: string }>("GET", `/public/blog/${slug}`);
  assert.ok(publishedSlug.status < 300 && publishedSlug.data.slug === slug);
  await api("PATCH", `/admin/blog/${post.data.id}`, { token, body: { isPublished: false } });
  const hiddenAgain = await api("GET", `/public/blog/${slug}`);
  assert.equal(hiddenAgain.status, 404);
  await api("DELETE", `/admin/blog/${post.data.id}`, { token });
  console.log("Blog unpublished slug 404 / published 200 / unpublished 404 ✓");

  const heroOriginal = publicSettings.data["hero.headline"];
  const heroPatch = await api("PUT", "/admin/settings", {
    token,
    body: { "hero.headline": "M4 CMS TEST headline" },
  });
  assert.ok(heroPatch.status < 300);
  const heroPublic = await api<Record<string, string>>("GET", "/public/settings");
  assert.equal(heroPublic.data["hero.headline"], "M4 CMS TEST headline");
  await api("PUT", "/admin/settings", { token, body: { "hero.headline": heroOriginal } });
  console.log("Hero CMS headline round-trip restored ✓");

  const tourUrl = publicSettings.data["tour.videoUrl"] ?? "";
  if (tourUrl.startsWith("/")) {
    const head = await fetch(`http://localhost:5173${tourUrl}`, { method: "HEAD" });
    console.log(`Tour media HEAD ${tourUrl} → ${head.status} (graceful player is a UI concern)`);
  }

  const restoredHour = await prisma.package.findUnique({ where: { id: hourPkg.id } });
  assert.equal(restoredHour?.priceKobo, 5_500_000);
  let holdSlot: string | null = null;
  for (let day = 1; day <= 10 && !holdSlot; day += 1) {
    const date = lagosDateOffset(day);
    const avail = await api<{ slots: string[] }>(
      "GET",
      `/bookings/availability?date=${encodeURIComponent(date)}&durationMinutes=60`,
    );
    holdSlot = avail.data.slots?.[0] ?? null;
  }
  assert.ok(holdSlot, "need an open slot for hold regression");
  const hold = await api<{
    bookingId: string;
    pricing: { payableKobo: number; baseKobo: number; discountPercent: number };
  }>("POST", "/bookings/hold", {
    body: {
      packageId: hourPkg.id,
      startTime: holdSlot,
      customerName: "M4 CMS Hold",
      customerPhone: `0803${String(Date.now()).slice(-7)}`,
      customerEmail: "m4-cms-hold@example.com",
    },
  });
  assert.ok(hold.status < 300, `hold ${hold.status} ${JSON.stringify(hold.data)}`);
  assert.equal(
    hold.data.pricing.payableKobo,
    5_225_000,
    `server online 5% of 55,000 should be 52,250 naira (${hold.data.pricing?.payableKobo})`,
  );
  assert.equal(hold.data.pricing.baseKobo, 5_500_000);
  assert.equal(hold.data.pricing.discountPercent, 5);
  console.log("Hold uses server-side 5% of restored ₦55,000 ✓");

  const malformed = await api("POST", "/admin/services", { token, body: { name: "" } });
  assert.ok(malformed.status >= 400, `malformed create ${malformed.status}`);
  console.log("Malformed CMS input rejected ✓");

  console.log("M4 CMS API chain passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
