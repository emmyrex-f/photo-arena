import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API_URL = "http://localhost:3001/api";

async function main() {
  console.log("=== Verifying C1, C2, C3, C4 Deliverables ===");

  // 1. Authenticate as owner
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.SEED_OWNER_EMAIL ?? "owner@photoarenang.com", password: process.env.SEED_OWNER_PASSWORD ?? "changeme" }),
  });
  assert.ok(loginRes.ok, `Login failed: ${loginRes.status}`);
  const { token } = await loginRes.json();
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
  console.log("✓ Owner authenticated");

  // 2. Test C1: Provisional Package Approval Workflow
  console.log("\n--- Testing C1: Provisional Package Approval Workflow ---");
  // Find a service to test
  const service = await prisma.service.findFirst({
    include: { packages: true },
  });
  assert.ok(service, "No service found in database to test");

  // Mark service as provisional for test
  await prisma.service.update({
    where: { id: service.id },
    data: { isProvisional: true },
  });
  if (service.packages[0]) {
    await prisma.package.update({
      where: { id: service.packages[0].id },
      data: { isProvisional: true },
    });
  }

  // Test individual service approval: POST /admin/services/:id/approve-pricing
  const approveRes = await fetch(`${API_URL}/admin/services/${service.id}/approve-pricing`, {
    method: "POST",
    headers: authHeaders,
  });
  assert.equal(approveRes.status, 201, `Failed to approve service pricing: ${approveRes.status}`);
  const approvedService = await approveRes.json();
  assert.equal(approvedService.isProvisional, false, "Service isProvisional should be false after approval");
  assert.ok(
    approvedService.packages.every((p: { isProvisional: boolean }) => p.isProvisional === false),
    "All packages should be non-provisional after approval",
  );
  console.log(`✓ Confirmed individual service final pricing: ${service.name}`);

  // Test catalog-wide approval: POST /admin/services/approve-all-pricing
  // Mark one package provisional again
  if (service.packages[0]) {
    await prisma.package.update({
      where: { id: service.packages[0].id },
      data: { isProvisional: true },
    });
  }
  const approveAllRes = await fetch(`${API_URL}/admin/services/approve-all-pricing`, {
    method: "POST",
    headers: authHeaders,
  });
  assert.equal(approveAllRes.status, 201, `Failed to approve all pricing: ${approveAllRes.status}`);
  const approveAllResult = await approveAllRes.json();
  assert.equal(approveAllResult.ok, true);

  const provisionalCount = await prisma.package.count({ where: { isProvisional: true } });
  assert.equal(provisionalCount, 0, "No packages should be provisional after approve-all-pricing");
  console.log("✓ Catalog-wide one-click pricing confirmation succeeded (0 provisional remaining)");

  // 3. Test C2, C3, C4: Blog Creation with WYSIWYG markdown, Media cover, and SEO metadata
  console.log("\n--- Testing C2, C3, C4: Blog Editor, Cover Image & SEO Metadata ---");
  const testSlug = `test-seo-wysiwyg-${Date.now()}`;
  const blogPayload = {
    title: "10 Tips for Flawless Studio Portraits in Port Harcourt",
    slug: testSlug,
    excerpt: "Professional studio portrait tips for lighting, poses, and outfit selection.",
    content: "## Welcome to Photo Arena\n\nHere are the top **tips** for your upcoming photoshoot.\n\n- Bring multiple outfits\n- Arrive 15 minutes early\n\n![Studio Lighting](/gallery/01-birthdays.jpg)\n\n| Package | Pricing |\n| :--- | :--- |\n| Gold | ₦100,000 |\n",
    coverImageUrl: "/gallery/01-birthdays.jpg",
    metaTitle: "Studio Portrait Tips | Photo Arena Port Harcourt",
    metaDescription: "Master your upcoming portrait session at Photo Arena with our professional photography guide.",
    ogImageUrl: "/gallery/02-weddings.jpg",
    tags: ["studio", "portraits", "tips"],
    isPublished: true,
  };

  const createBlogRes = await fetch(`${API_URL}/admin/blog`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(blogPayload),
  });
  assert.equal(createBlogRes.status, 201, `Failed to create blog post: ${createBlogRes.status}`);
  const createdPost = await createBlogRes.json();
  assert.equal(createdPost.slug, testSlug);
  assert.equal(createdPost.metaTitle, blogPayload.metaTitle);
  assert.equal(createdPost.metaDescription, blogPayload.metaDescription);
  assert.equal(createdPost.ogImageUrl, blogPayload.ogImageUrl);
  assert.equal(createdPost.coverImageUrl, blogPayload.coverImageUrl);
  assert.ok(createdPost.content.includes("## Welcome to Photo Arena"));
  console.log(`✓ Blog post created with ID ${createdPost.id} and per-post SEO fields`);

  // 4. Test C4: Verify Public API retrieval with SEO metadata
  const publicPostRes = await fetch(`${API_URL}/public/blog/${testSlug}`);
  assert.equal(publicPostRes.status, 200, `Failed to fetch public blog post: ${publicPostRes.status}`);
  const publicPost = await publicPostRes.json();
  assert.equal(publicPost.metaTitle, blogPayload.metaTitle, "Public post should have metaTitle");
  assert.equal(publicPost.metaDescription, blogPayload.metaDescription, "Public post should have metaDescription");
  assert.equal(publicPost.ogImageUrl, blogPayload.ogImageUrl, "Public post should have ogImageUrl");
  console.log("✓ Public blog endpoint correctly returns per-post SEO fields for search indexing and social cards");

  // 5. Test blog list endpoint includes SEO fields
  const publicListRes = await fetch(`${API_URL}/public/blog`);
  assert.equal(publicListRes.status, 200);
  const publicList = await publicListRes.json();
  const foundItem = publicList.items.find((p: { slug: string }) => p.slug === testSlug);
  assert.ok(foundItem, "Created blog post should be in public blog list");
  assert.equal(foundItem.metaTitle, blogPayload.metaTitle);
  assert.equal(foundItem.metaDescription, blogPayload.metaDescription);
  assert.equal(foundItem.ogImageUrl, blogPayload.ogImageUrl);
  console.log("✓ Public blog listing endpoint includes per-post SEO fields");

  // 6. Test update SEO metadata
  const updatedMetaTitle = "Updated SEO Title 2026";
  const updateRes = await fetch(`${API_URL}/admin/blog/${createdPost.id}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ metaTitle: updatedMetaTitle }),
  });
  assert.equal(updateRes.status, 200);
  const updatedPost = await updateRes.json();
  assert.equal(updatedPost.metaTitle, updatedMetaTitle);
  console.log("✓ Blog post updated with new SEO metadata");

  // 7. Cleanup test blog post
  const deleteRes = await fetch(`${API_URL}/admin/blog/${createdPost.id}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  assert.equal(deleteRes.status, 200);
  console.log("✓ Test blog post cleanly removed");

  console.log("\n========================================================");
  console.log("🎉 ALL C1, C2, C3, C4 VERIFICATIONS PASSED (100% SUCCESS)!");
  console.log("========================================================\n");
}

main()
  .catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
