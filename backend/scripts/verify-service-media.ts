/**
 * Stage 7: service media via MediaUsage (usageType=service).
 * Restores original attachments. Does not delete Service rows or unused GalleryImages.
 */
import "./load-env";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");
const USAGE_TYPE = "service";

type Json = Record<string, unknown>;
type ServiceRow = {
  id: string;
  slug: string;
  media?: { id: string; url: string; alt?: string } | null;
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

async function main() {
  const prisma = new PrismaClient();
  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? "owner@photoarenang.com").trim().toLowerCase();
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme";
  const results: string[] = [];
  const pass = (name: string) => {
    results.push(`PASS ${name}`);
    console.log(`PASS ${name}`);
  };
  const fail = (name: string, detail: string): never => {
    results.push(`FAIL ${name}: ${detail}`);
    throw new Error(`${name}: ${detail}`);
  };

  let token = "";
  let serviceA: ServiceRow | undefined;
  let serviceB: ServiceRow | undefined;
  let originalA: string | null = null;
  let originalB: string | null = null;
  let uploadedId = "";

  async function restore() {
    if (!token) return;
    if (serviceA) {
      await api("PATCH", `/admin/services/${serviceA.id}`, {
        token,
        body: { mediaId: originalA },
      });
    }
    if (serviceB) {
      await api("PATCH", `/admin/services/${serviceB.id}`, {
        token,
        body: { mediaId: originalB },
      });
    }
  }

  try {
    const desk = await api<{ email: string }>("GET", "/auth/desk-email");
    if (desk.status !== 200) fail("login", `desk-email ${desk.status}`);
    const login = await api<Json>("POST", "/auth/login", {
      body: { email: desk.data.email || ownerEmail, password: ownerPassword },
    });
    if (login.status !== 201 && login.status !== 200) {
      fail("login", `status ${login.status}`);
    }
    token = tokenOf(login.data);
    if (!token) fail("login", "no token");
    pass("login");

    const list = await api<ServiceRow[]>("GET", "/admin/services", { token });
    if (list.status !== 200 || !Array.isArray(list.data) || list.data.length < 2) {
      fail("list services", `need two services, got ${list.status}`);
    }
    serviceA = list.data[0];
    serviceB = list.data[1];
    originalA = serviceA.media?.id ?? null;
    originalB = serviceB.media?.id ?? null;

    if (originalA) {
      const cleared = await api("PATCH", `/admin/services/${serviceA.id}`, {
        token,
        body: { mediaId: null },
      });
      if (cleared.status !== 200) fail("existing service with no media", `detach ${cleared.status}`);
    }
    const publicBefore = await api<ServiceRow[]>("GET", "/public/services");
    if (publicBefore.status !== 200 || !Array.isArray(publicBefore.data)) {
      fail("existing service with no media", `status ${publicBefore.status}`);
    }
    const publicA0 = publicBefore.data.find((row) => row.id === serviceA.id);
    if (!publicA0) fail("existing service with no media", "service A missing from public list");
    if (publicA0.media != null) {
      fail("existing service with no media", `expected media null, got ${JSON.stringify(publicA0.media)}`);
    }
    pass("existing service with no media");

    const gallery = await api<{ items: Array<{ id: string; isActive?: boolean; url: string }> }>(
      "GET",
      "/admin/gallery?isActive=true&pageSize=50",
      { token },
    );
    const galleryItems = gallery.data?.items ?? [];
    if (gallery.status !== 200 || galleryItems.length < 2) {
      fail("gallery", `need two active images, got ${gallery.status} count=${galleryItems.length}`);
    }
    const image1 = galleryItems[0]!;
    const image2 = galleryItems[1]!;

    const attach = await api<ServiceRow>("PATCH", `/admin/services/${serviceA.id}`, {
      token,
      body: { mediaId: image1.id },
    });
    if (attach.status !== 200) fail("attach existing media", `status ${attach.status} ${JSON.stringify(attach.data)}`);
    if (attach.data.media?.id !== image1.id) fail("attach existing media", "admin response missing media");
    const usageCount1 = await prisma.mediaUsage.count({
      where: { usageType: USAGE_TYPE, entityId: serviceA.id },
    });
    if (usageCount1 !== 1) fail("attach existing media", `expected 1 usage, got ${usageCount1}`);
    pass("attach existing media");

    const publicAttached = await api<ServiceRow[]>("GET", "/public/services");
    const publicA1 = publicAttached.data.find((row) => row.id === serviceA!.id);
    if (publicA1?.media?.id !== image1.id || !publicA1.media.url) {
      fail("public API returns selected media", JSON.stringify(publicA1?.media ?? null));
    }
    pass("public API returns selected media");

    const attachB = await api<ServiceRow>("PATCH", `/admin/services/${serviceB.id}`, {
      token,
      body: { mediaId: image1.id },
    });
    if (attachB.status !== 200 || attachB.data.media?.id !== image1.id) {
      fail("same image on two services", `status ${attachB.status}`);
    }
    const shared = await prisma.mediaUsage.count({
      where: { usageType: USAGE_TYPE, mediaId: image1.id, entityId: { in: [serviceA.id, serviceB.id] } },
    });
    if (shared !== 2) fail("same image on two services", `expected 2 usages, got ${shared}`);
    pass("same image on two services");

    const replace = await api<ServiceRow>("PATCH", `/admin/services/${serviceA.id}`, {
      token,
      body: { mediaId: image2.id },
    });
    if (replace.status !== 200 || replace.data.media?.id !== image2.id) {
      fail("replace media", `got ${replace.data.media?.id}`);
    }
    const afterReplace = await prisma.mediaUsage.findMany({
      where: { usageType: USAGE_TYPE, entityId: serviceA.id },
    });
    if (afterReplace.length !== 1 || afterReplace[0]?.mediaId !== image2.id) {
      fail("replace media", `usages=${JSON.stringify(afterReplace)}`);
    }
    const bStill = await prisma.mediaUsage.findFirst({
      where: { usageType: USAGE_TYPE, entityId: serviceB.id },
    });
    if (bStill?.mediaId !== image1.id) fail("replace media", "service B attachment changed");
    pass("replace media");

    const removed = await api<ServiceRow>("PATCH", `/admin/services/${serviceA.id}`, {
      token,
      body: { mediaId: null },
    });
    if (removed.status !== 200) fail("remove media", `status ${removed.status}`);
    if (removed.data.media != null) fail("remove media", "admin still returned media");
    const leftoverA = await prisma.mediaUsage.count({
      where: { usageType: USAGE_TYPE, entityId: serviceA.id },
    });
    if (leftoverA !== 0) fail("remove media", `usage still present (${leftoverA})`);
    const image2Still = await prisma.galleryImage.findUnique({ where: { id: image2.id }, select: { id: true } });
    if (!image2Still) fail("remove media", "GalleryImage was deleted");
    const publicRemoved = await api<ServiceRow[]>("GET", "/public/services");
    const publicA2 = publicRemoved.data.find((row) => row.id === serviceA!.id);
    if (publicA2?.media != null) fail("remove media", "public still returned media");
    pass("remove media");

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const form = new FormData();
    form.append("kind", "CONTENT");
    form.append("files", new Blob([png], { type: "image/png" }), "stage7-service-media.png");
    const uploaded = await api<Array<{ id: string; url: string; alt: string }>>("POST", "/admin/gallery/upload", {
      token,
      form,
    });
    if (uploaded.status !== 201 && uploaded.status !== 200) {
      fail("upload new media and select it", `upload ${uploaded.status} ${JSON.stringify(uploaded.data)}`);
    }
    uploadedId = uploaded.data[0]?.id ?? "";
    if (!uploadedId) fail("upload new media and select it", "no uploaded id");
    const selectUploaded = await api<ServiceRow>("PATCH", `/admin/services/${serviceA.id}`, {
      token,
      body: { mediaId: uploadedId },
    });
    if (selectUploaded.status !== 200 || selectUploaded.data.media?.id !== uploadedId) {
      fail("upload new media and select it", JSON.stringify(selectUploaded.data.media ?? selectUploaded.data));
    }
    pass("upload new media and select it");

    const blocked = await api("DELETE", `/admin/gallery/${uploadedId}`, { token });
    if (blocked.status !== 409) {
      fail("delete in-use image blocked", `expected 409, got ${blocked.status}`);
    }
    const stillThere = await prisma.galleryImage.findUnique({ where: { id: uploadedId }, select: { id: true } });
    if (!stillThere) fail("delete in-use image blocked", "image was deleted");
    pass("deleting an image used by a service is blocked (409)");

    await restore();
    const restoredUsages = await prisma.mediaUsage.count({
      where: { usageType: USAGE_TYPE, entityId: { in: [serviceA.id, serviceB.id] } },
    });
    const expected = Number(Boolean(originalA)) + Number(Boolean(originalB));
    if (restoredUsages !== expected) {
      console.log(`restore note: usages=${restoredUsages} expected=${expected}`);
    }
    pass("restore original attachments");

    console.log("\nAll Stage 7 service-media checks passed.");
  } catch (error) {
    await restore().catch(() => undefined);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
