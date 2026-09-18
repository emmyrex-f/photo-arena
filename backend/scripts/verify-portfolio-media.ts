/**
 * Stage 8: portfolio media via MediaUsage (usageType=portfolio, entityId=GalleryImage.id).
 * Restores original attachments. Does not delete GalleryImage or Service rows.
 */
import "./load-env";
import { PrismaClient } from "@prisma/client";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");
const USAGE_TYPE = "portfolio";

type Json = Record<string, unknown>;
type GalleryRow = {
  id: string;
  url: string;
  kind?: string;
  media?: { id: string; url: string } | null;
};
type PublicRow = {
  id: string;
  url: string;
  media?: { id: string; url: string } | null;
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
  const pass = (name: string) => console.log(`PASS ${name}`);
  const fail = (name: string, detail: string): never => {
    throw new Error(`${name}: ${detail}`);
  };

  let token = "";
  let itemA: GalleryRow | undefined;
  let itemB: GalleryRow | undefined;
  let originalA: string | null = null;
  let originalB: string | null = null;
  let uploadedId = "";
  let publicCountBefore = 0;

  async function restore() {
    if (!token) return;
    if (itemA) {
      await api("PATCH", `/admin/gallery/${itemA.id}`, { token, body: { mediaId: originalA } });
    }
    if (itemB) {
      await api("PATCH", `/admin/gallery/${itemB.id}`, { token, body: { mediaId: originalB } });
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

    const publicBefore = await api<PublicRow[]>("GET", "/public/gallery");
    if (publicBefore.status !== 200 || !Array.isArray(publicBefore.data) || publicBefore.data.length < 2) {
      fail("existing portfolio still renders", `status ${publicBefore.status} count=${Array.isArray(publicBefore.data) ? publicBefore.data.length : 0}`);
    }
    publicCountBefore = publicBefore.data.length;
    const urls = publicBefore.data.map((row) => row.url).filter(Boolean);
    if (urls.length !== publicCountBefore) fail("existing portfolio still renders", "missing urls");
    pass("existing portfolio still renders");

    const list = await api<GalleryRow[]>("GET", "/admin/gallery?kind=GALLERY&isActive=true", { token });
    if (list.status !== 200 || !Array.isArray(list.data) || list.data.length < 2) {
      fail("list portfolio items", `status ${list.status}`);
    }
    itemA = list.data[0];
    itemB = list.data[1];
    originalA = itemA.media?.id ?? null;
    originalB = itemB.media?.id ?? null;
    const originalUrlA = publicBefore.data.find((row) => row.id === itemA!.id)?.url ?? itemA.url;

    const library = await api<GalleryRow[]>("GET", "/admin/gallery?isActive=true", { token });
    const candidates = (library.data ?? []).filter((row) => row.id !== itemA!.id && row.id !== itemB!.id);
    if (candidates.length < 2) fail("library", "need two other active images");
    const image1 = candidates[0]!;
    const image2 = candidates[1]!;

    const attach = await api<GalleryRow>("PATCH", `/admin/gallery/${itemA.id}`, {
      token,
      body: { mediaId: image1.id },
    });
    if (attach.status !== 200 || attach.data.media?.id !== image1.id) {
      fail("attach existing media", `status ${attach.status} ${JSON.stringify(attach.data.media ?? attach.data)}`);
    }
    const usageCount = await prisma.mediaUsage.count({
      where: { usageType: USAGE_TYPE, entityId: itemA.id },
    });
    if (usageCount !== 1) fail("attach existing media", `expected 1 usage, got ${usageCount}`);
    pass("attach existing media");

    const publicAttached = await api<PublicRow[]>("GET", "/public/gallery");
    if (publicAttached.data.length !== publicCountBefore) {
      fail("portfolio count intact", `before=${publicCountBefore} after=${publicAttached.data.length}`);
    }
    const publicA1 = publicAttached.data.find((row) => row.id === itemA.id);
    if (publicA1?.url !== image1.url) fail("public resolves MediaUsage", `got ${publicA1?.url}`);
    pass("public resolves attached media");

    const attachB = await api<GalleryRow>("PATCH", `/admin/gallery/${itemB.id}`, {
      token,
      body: { mediaId: image1.id },
    });
    if (attachB.status !== 200 || attachB.data.media?.id !== image1.id) {
      fail("same image on two portfolio items", `status ${attachB.status}`);
    }
    const shared = await prisma.mediaUsage.count({
      where: { usageType: USAGE_TYPE, mediaId: image1.id, entityId: { in: [itemA.id, itemB.id] } },
    });
    if (shared !== 2) fail("same image on two portfolio items", `got ${shared}`);
    pass("same image on two portfolio items");

    const replace = await api<GalleryRow>("PATCH", `/admin/gallery/${itemA.id}`, {
      token,
      body: { mediaId: image2.id },
    });
    if (replace.status !== 200 || replace.data.media?.id !== image2.id) {
      fail("replace media", `got ${replace.data.media?.id}`);
    }
    const afterReplace = await prisma.mediaUsage.findMany({
      where: { usageType: USAGE_TYPE, entityId: itemA.id },
    });
    if (afterReplace.length !== 1 || afterReplace[0]?.mediaId !== image2.id) {
      fail("replace media", JSON.stringify(afterReplace));
    }
    pass("replace media");

    const removed = await api<GalleryRow>("PATCH", `/admin/gallery/${itemA.id}`, {
      token,
      body: { mediaId: null },
    });
    if (removed.status !== 200) fail("remove media", `status ${removed.status}`);
    if (removed.data.media != null) fail("remove media", "admin still returned media");
    const leftover = await prisma.mediaUsage.count({
      where: { usageType: USAGE_TYPE, entityId: itemA.id },
    });
    if (leftover !== 0) fail("remove media", `usage still present (${leftover})`);
    const image2Still = await prisma.galleryImage.findUnique({ where: { id: image2.id }, select: { id: true } });
    if (!image2Still) fail("remove media", "GalleryImage was deleted");
    const publicRemoved = await api<PublicRow[]>("GET", "/public/gallery");
    const publicA2 = publicRemoved.data.find((row) => row.id === itemA.id);
    if (publicA2?.url !== originalUrlA) fail("remove media", `expected original url, got ${publicA2?.url}`);
    if (publicRemoved.data.length !== publicCountBefore) {
      fail("existing portfolio images remain intact", `count ${publicRemoved.data.length}`);
    }
    pass("remove media");
    pass("existing portfolio images/data remain intact");

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const form = new FormData();
    form.append("kind", "CONTENT");
    form.append("files", new Blob([png], { type: "image/png" }), "stage8-portfolio-media.png");
    const uploaded = await api<Array<{ id: string; url: string }>>("POST", "/admin/gallery/upload", {
      token,
      form,
    });
    if (uploaded.status !== 201 && uploaded.status !== 200) {
      fail("upload new media and attach it", `upload ${uploaded.status}`);
    }
    uploadedId = uploaded.data[0]?.id ?? "";
    if (!uploadedId) fail("upload new media and attach it", "no uploaded id");
    const selectUploaded = await api<GalleryRow>("PATCH", `/admin/gallery/${itemA.id}`, {
      token,
      body: { mediaId: uploadedId },
    });
    if (selectUploaded.status !== 200 || selectUploaded.data.media?.id !== uploadedId) {
      fail("upload new media and attach it", JSON.stringify(selectUploaded.data.media ?? selectUploaded.data));
    }
    pass("upload new media and attach it");

    const blocked = await api("DELETE", `/admin/gallery/${uploadedId}`, { token });
    if (blocked.status !== 409) {
      fail("delete in-use image blocked", `expected 409, got ${blocked.status}`);
    }
    const stillThere = await prisma.galleryImage.findUnique({ where: { id: uploadedId }, select: { id: true } });
    if (!stillThere) fail("delete in-use image blocked", "image was deleted");
    pass("deleting an in-use image returns 409");

    await restore();
    const publicEnd = await api<PublicRow[]>("GET", "/public/gallery");
    if (publicEnd.data.length !== publicCountBefore) {
      fail("restore count", `${publicEnd.data.length} vs ${publicCountBefore}`);
    }
    pass("restore original attachments");
    console.log("\nAll Stage 8 portfolio-media checks passed.");
  } catch (error) {
    await restore().catch(() => undefined);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
