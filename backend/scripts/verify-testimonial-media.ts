/**
 * Stage 11: testimonial media via MediaUsage (usageType=testimonial).
 * Restores original testimonials. Deletes only rows this script created.
 */
import "./load-env";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");
const USAGE_TYPE = "testimonial";

type Json = Record<string, unknown>;
type Media = { id: string; url: string; thumbUrl: string | null; alt: string } | null;
type TestimonialRow = {
  id: string;
  quote: string;
  name: string;
  role?: string | null;
  rating?: number | null;
  isPublished?: boolean;
  media?: Media;
};

async function api<T = Json>(
  method: string,
  path: string,
  opts?: { body?: unknown; token?: string; form?: FormData },
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {};
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  let body: BodyInit | undefined;
  if (opts?.form) {
    body = opts.form;
  } else if (opts?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const response = await fetch(`${API_BASE}${path}`, { method, headers, body });
  const text = await response.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    data = { raw: text } as T;
  }
  return { status: response.status, data };
}

function tokenOf(data: Json) {
  return (typeof data.token === "string" && data.token) || (typeof data.accessToken === "string" && data.accessToken) || "";
}

function snapshot(row: TestimonialRow) {
  return JSON.stringify({
    quote: row.quote,
    name: row.name,
    role: row.role ?? null,
    rating: row.rating ?? null,
    isPublished: row.isPublished ?? null,
    mediaId: row.media?.id ?? null,
  });
}

async function main() {
  const prisma = new PrismaClient();
  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? "owner@photoarenang.com").trim().toLowerCase();
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme";
  const createdIds: string[] = [];
  let token = "";
  let uploadedId = "";
  let a: TestimonialRow | undefined;
  let b: TestimonialRow | undefined;

  const pass = (name: string) => console.log(`PASS ${name}`);
  const fail = (name: string, detail: string): never => {
    throw new Error(`${name}: ${detail}`);
  };

  async function cleanup() {
    if (!token) return;
    for (const id of createdIds) {
      await api("DELETE", `/admin/testimonials/${id}`, { token }).catch(() => undefined);
    }
    if (uploadedId) {
      await api("PATCH", `/admin/testimonials/${a?.id ?? "_"}`, {
        token,
        body: { mediaId: null },
      }).catch(() => undefined);
      await api("PATCH", `/admin/testimonials/${b?.id ?? "_"}`, {
        token,
        body: { mediaId: null },
      }).catch(() => undefined);
      const inUse = await prisma.mediaUsage.count({ where: { mediaId: uploadedId } });
      if (inUse === 0) {
        await api("DELETE", `/admin/gallery/${uploadedId}`, { token }).catch(() => undefined);
      }
    }
  }

  try {
    const desk = await api<{ email: string }>("GET", "/auth/desk-email");
    if (desk.status !== 200) fail("login", `desk-email ${desk.status}`);
    const login = await api<Json>("POST", "/auth/login", {
      body: { email: desk.data.email || ownerEmail, password: ownerPassword },
    });
    if (login.status !== 201 && login.status !== 200) fail("login", `status ${login.status}`);
    token = tokenOf(login.data);
    if (!token) fail("login", "no token");
    pass("login");

    const before = await api<TestimonialRow[]>("GET", "/admin/testimonials", { token });
    if (before.status !== 200 || !Array.isArray(before.data)) {
      fail("existing testimonials still work", `list ${before.status}`);
    }
    const originalById = new Map(before.data.map((row) => [row.id, snapshot(row)]));
    const publicBefore = await api<TestimonialRow[]>("GET", "/public/testimonials");
    if (publicBefore.status !== 200 || !Array.isArray(publicBefore.data)) {
      fail("existing testimonials still work", `public ${publicBefore.status}`);
    }
    for (const row of publicBefore.data) {
      if (!row.quote || !row.name) fail("existing testimonials still work", `missing text on ${row.id}`);
      if (row.media !== null && (!row.media?.id || !row.media.url)) {
        fail("existing testimonials still work", `invalid media on ${row.id}`);
      }
    }
    pass("existing testimonials still work");

    const stamp = Date.now();
    const createdA = await api<TestimonialRow>("POST", "/admin/testimonials", {
      token,
      body: {
        quote: `Stage 11 verify A ${stamp}`,
        name: "Stage 11 Client A",
        role: "Client",
        rating: 5,
        isPublished: true,
      },
    });
    if (createdA.status !== 201 && createdA.status !== 200) {
      fail("create", `status ${createdA.status} ${JSON.stringify(createdA.data)}`);
    }
    a = createdA.data;
    createdIds.push(a.id);
    if (a.media != null) fail("existing testimonials still work", "new row should have media null");

    const createdB = await api<TestimonialRow>("POST", "/admin/testimonials", {
      token,
      body: {
        quote: `Stage 11 verify B ${stamp}`,
        name: "Stage 11 Client B",
        role: "Client",
        rating: 4,
        isPublished: true,
      },
    });
    if (createdB.status !== 201 && createdB.status !== 200) {
      fail("create", `status ${createdB.status}`);
    }
    b = createdB.data;
    createdIds.push(b.id);

    const gallery = await api<{ items: Array<{ id: string; isActive?: boolean; url: string }> }>(
      "GET",
      "/admin/gallery?isActive=true&pageSize=50",
      { token },
    );
    const galleryItems = gallery.data?.items ?? [];
    if (gallery.status !== 200 || galleryItems.length < 2) {
      fail("gallery", `need two active images, got ${gallery.status}`);
    }
    const image1 = galleryItems[0]!;
    const image2 = galleryItems[1]!;

    const attach = await api<TestimonialRow>("PATCH", `/admin/testimonials/${a.id}`, {
      token,
      body: { mediaId: image1.id },
    });
    if (attach.status !== 200) fail("attach existing image", `status ${attach.status} ${JSON.stringify(attach.data)}`);
    if (attach.data.media?.id !== image1.id) fail("attach existing image", "admin response missing media");
    assert.equal(attach.data.quote, a.quote);
    assert.equal(attach.data.name, a.name);
    const usageCount1 = await prisma.mediaUsage.count({
      where: { usageType: USAGE_TYPE, entityId: a.id },
    });
    if (usageCount1 !== 1) fail("attach existing image", `expected 1 usage, got ${usageCount1}`);
    pass("attach existing image");

    const publicAttached = await api<TestimonialRow[]>("GET", "/public/testimonials");
    const publicA1 = publicAttached.data.find((row) => row.id === a.id);
    if (publicA1?.media?.id !== image1.id || !publicA1.media.url || publicA1.media.thumbUrl === undefined) {
      fail("public API returns media correctly", JSON.stringify(publicA1?.media ?? null));
    }
    if (!("alt" in (publicA1.media ?? {}))) fail("public API returns media correctly", "missing alt");
    pass("public API returns media correctly");

    const attachB = await api<TestimonialRow>("PATCH", `/admin/testimonials/${b.id}`, {
      token,
      body: { mediaId: image1.id },
    });
    if (attachB.status !== 200 || attachB.data.media?.id !== image1.id) {
      fail("same image on multiple testimonials", `status ${attachB.status}`);
    }
    const shared = await prisma.mediaUsage.count({
      where: { usageType: USAGE_TYPE, mediaId: image1.id, entityId: { in: [a.id, b.id] } },
    });
    if (shared !== 2) fail("same image on multiple testimonials", `expected 2 usages, got ${shared}`);
    pass("same image can be used on multiple testimonials");

    const replace = await api<TestimonialRow>("PATCH", `/admin/testimonials/${a.id}`, {
      token,
      body: { mediaId: image2.id },
    });
    if (replace.status !== 200 || replace.data.media?.id !== image2.id) {
      fail("replace image", `got ${replace.data.media?.id}`);
    }
    const afterReplace = await prisma.mediaUsage.findMany({
      where: { usageType: USAGE_TYPE, entityId: a.id },
    });
    if (afterReplace.length !== 1 || afterReplace[0]?.mediaId !== image2.id) {
      fail("replace image", `usages=${JSON.stringify(afterReplace)}`);
    }
    const bStill = await prisma.mediaUsage.findFirst({
      where: { usageType: USAGE_TYPE, entityId: b.id },
    });
    if (bStill?.mediaId !== image1.id) fail("replace image", "testimonial B attachment changed");
    assert.equal(replace.data.quote, a.quote);
    pass("replace image");

    const removed = await api<TestimonialRow>("PATCH", `/admin/testimonials/${a.id}`, {
      token,
      body: { mediaId: null },
    });
    if (removed.status !== 200) fail("remove image", `status ${removed.status}`);
    if (removed.data.media != null) fail("remove image", "admin still returned media");
    const leftoverA = await prisma.mediaUsage.count({
      where: { usageType: USAGE_TYPE, entityId: a.id },
    });
    if (leftoverA !== 0) fail("remove image", `usage still present (${leftoverA})`);
    const image2Still = await prisma.galleryImage.findUnique({ where: { id: image2.id }, select: { id: true } });
    if (!image2Still) fail("remove image", "GalleryImage was deleted");
    const publicRemoved = await api<TestimonialRow[]>("GET", "/public/testimonials");
    const publicA2 = publicRemoved.data.find((row) => row.id === a.id);
    if (publicA2?.media != null) fail("remove image", "public still returned media");
    assert.equal(removed.data.quote, a.quote);
    assert.equal(removed.data.name, a.name);
    pass("remove image");

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const form = new FormData();
    form.append("kind", "CONTENT");
    form.append("files", new Blob([png], { type: "image/png" }), "stage11-testimonial-media.png");
    const uploaded = await api<Array<{ id: string; url: string; alt: string }>>("POST", "/admin/gallery/upload", {
      token,
      form,
    });
    if (uploaded.status !== 201 && uploaded.status !== 200) {
      fail("upload + attach", `upload ${uploaded.status} ${JSON.stringify(uploaded.data)}`);
    }
    uploadedId = uploaded.data[0]?.id ?? "";
    if (!uploadedId) fail("upload + attach", "no uploaded id");
    const selectUploaded = await api<TestimonialRow>("PATCH", `/admin/testimonials/${a.id}`, {
      token,
      body: { mediaId: uploadedId },
    });
    if (selectUploaded.status !== 200 || selectUploaded.data.media?.id !== uploadedId) {
      fail("upload + attach", JSON.stringify(selectUploaded.data.media ?? selectUploaded.data));
    }
    pass("upload + attach");

    const blocked = await api("DELETE", `/admin/gallery/${uploadedId}`, { token });
    if (blocked.status !== 409) {
      fail("in-use image deletion returns 409", `expected 409, got ${blocked.status}`);
    }
    const stillThere = await prisma.galleryImage.findUnique({ where: { id: uploadedId }, select: { id: true } });
    if (!stillThere) fail("in-use image deletion returns 409", "image was deleted");
    pass("in-use image deletion returns 409");

    const after = await api<TestimonialRow[]>("GET", "/admin/testimonials", { token });
    for (const [id, snap] of originalById) {
      const row = after.data.find((item) => item.id === id);
      if (!row) fail("existing testimonial text/data remains intact", `missing ${id}`);
      if (snapshot(row) !== snap) {
        fail("existing testimonial text/data remains intact", `${id} changed ${snap} → ${snapshot(row)}`);
      }
    }
    pass("existing testimonial text/data remains intact");

    await cleanup();
    createdIds.length = 0;
    uploadedId = "";

    const finalList = await api<TestimonialRow[]>("GET", "/admin/testimonials", { token });
    const leftoverCreated = finalList.data.filter((row) => originalById.has(row.id) === false && (row.name ?? "").startsWith("Stage 11 Client"));
    if (leftoverCreated.length) {
      fail("cleanup", `left behind ${leftoverCreated.map((row) => row.id).join(", ")}`);
    }

    console.log("\nAll Stage 11 testimonial-media checks passed.");
  } catch (error) {
    await cleanup().catch(() => undefined);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
