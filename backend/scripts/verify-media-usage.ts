/**
 * Runtime verification of MediaUsage against a running API + PostgreSQL.
 * Uses a temporary entity id only; never a real service id.
 */
import "./load-env";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");
const ENTITY_ID = "tmp_mu_stage5_verify";
const USAGE_TYPE = "service";

type Json = Record<string, unknown>;

async function api<T = Json>(
  method: string,
  path: string,
  opts?: { body?: unknown; token?: string },
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {};
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
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

async function main() {
  const prisma = new PrismaClient();
  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? "owner@photoarenang.com").trim().toLowerCase();
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "changeme";
  let token = "";
  let mediaId = "";

  const results: string[] = [];
  const pass = (name: string) => {
    results.push(`PASS ${name}`);
    console.log(`PASS ${name}`);
  };
  const fail = (name: string, detail: string) => {
    results.push(`FAIL ${name}: ${detail}`);
    throw new Error(`${name}: ${detail}`);
  };

  try {
    const desk = await api<{ email: string }>("GET", "/auth/desk-email");
    assert.equal(desk.status, 200, `desk-email ${desk.status}`);
    const login = await api<{ accessToken: string }>("POST", "/auth/login", {
      body: { email: desk.data.email || ownerEmail, password: ownerPassword },
    });
    if (login.status !== 201 && login.status !== 200) {
      fail("login", `status ${login.status} ${JSON.stringify(login.data)}`);
    }
    token = (login.data as { accessToken?: string; token?: string }).accessToken
      ?? (login.data as { token?: string }).token
      ?? "";
    if (!token) fail("login", `no token in ${JSON.stringify(login.data)}`);
    pass("login");

    const leftoverStart = await prisma.mediaUsage.deleteMany({
      where: { usageType: USAGE_TYPE, entityId: ENTITY_ID },
    });
    if (leftoverStart.count > 0) {
      console.log(`pre-clean deleted ${leftoverStart.count} leftover row(s)`);
    }

    const unused = await prisma.galleryImage.findFirst({
      where: { isActive: true, usages: { none: {} } },
      select: { id: true },
      orderBy: { sortOrder: "asc" },
    });
    if (!unused) fail("pick-active-media", "no unused active GalleryImage");
    mediaId = unused.id;
    pass(`pick-active-media ${mediaId}`);

    const attachBody = { mediaId, usageType: USAGE_TYPE, entityId: ENTITY_ID };
    const first = await api<{ id: string; mediaId: string; usageType: string; entityId: string }>(
      "POST",
      "/admin/media-usages",
      { token, body: attachBody },
    );
    if (first.status !== 201 && first.status !== 200) {
      fail("attach", `status ${first.status} ${JSON.stringify(first.data)}`);
    }
    if (first.data.mediaId !== mediaId || first.data.entityId !== ENTITY_ID) {
      fail("attach", `unexpected payload ${JSON.stringify(first.data)}`);
    }
    const usageId = first.data.id;
    pass(`attach usageId=${usageId}`);

    const second = await api<{ id: string }>("POST", "/admin/media-usages", {
      token,
      body: attachBody,
    });
    if (second.status !== 201 && second.status !== 200) {
      fail("duplicate-attach-http", `status ${second.status} ${JSON.stringify(second.data)}`);
    }
    if (second.data.id !== usageId) {
      fail("duplicate-prevention", `second id ${second.data.id} !== ${usageId}`);
    }
    const listed = await api<Array<{ id: string }>>(
      "GET",
      `/admin/media-usages?usageType=${USAGE_TYPE}&entityId=${ENTITY_ID}`,
      { token },
    );
    if (listed.status !== 200 || !Array.isArray(listed.data) || listed.data.length !== 1) {
      fail("duplicate-row-count", `status ${listed.status} count=${Array.isArray(listed.data) ? listed.data.length : "n/a"}`);
    }
    const dbCount = await prisma.mediaUsage.count({
      where: { mediaId, usageType: USAGE_TYPE, entityId: ENTITY_ID },
    });
    if (dbCount !== 1) fail("duplicate-db-count", `db rows=${dbCount}`);
    pass("duplicate-prevention (same usage id, one row)");

    const forEntity = await api<Array<{ id: string; media?: { id: string; url: string } }>>(
      "GET",
      `/admin/media-usages?usageType=${USAGE_TYPE}&entityId=${ENTITY_ID}`,
      { token },
    );
    if (forEntity.status !== 200 || forEntity.data[0]?.media?.id !== mediaId) {
      fail("listMediaForEntity", JSON.stringify(forEntity.data));
    }
    pass("listMediaForEntity returns media");

    const forMedia = await api<Array<{ usageType: string; entityId: string }>>(
      "GET",
      `/admin/media-usages/media/${mediaId}`,
      { token },
    );
    const match = Array.isArray(forMedia.data)
      ? forMedia.data.find((row) => row.usageType === USAGE_TYPE && row.entityId === ENTITY_ID)
      : undefined;
    if (forMedia.status !== 200 || !match) fail("listUsagesForMedia", JSON.stringify(forMedia.data));
    pass("listUsagesForMedia returns usage");

    const checkInUse = await api<{ inUse: boolean; count: number }>(
      "GET",
      `/admin/media-usages/media/${mediaId}/deletion-check`,
      { token },
    );
    if (checkInUse.status !== 200 || checkInUse.data.inUse !== true || checkInUse.data.count !== 1) {
      fail("deletionCheck-inUse", JSON.stringify(checkInUse.data));
    }
    pass("deletionCheck inUse=true count=1");

    const blocked = await api("DELETE", `/admin/gallery/${mediaId}`, { token });
    if (blocked.status !== 409) {
      fail("gallery-delete-409", `status ${blocked.status} ${JSON.stringify(blocked.data)}`);
    }
    const conflict = blocked.data as { inUse?: boolean; count?: number; message?: string };
    // Nest may return either structured { inUse, count } or a ConflictException message.
    const messageOk =
      typeof conflict.message === "string" && /in use|cannot delete/i.test(conflict.message);
    const structuredOk = conflict.inUse === true && conflict.count === 1;
    if (!messageOk && !structuredOk) {
      fail("gallery-delete-409-body", JSON.stringify(blocked.data));
    }
    const stillThere = await prisma.galleryImage.findUnique({ where: { id: mediaId }, select: { id: true } });
    if (!stillThere) fail("gallery-delete-409", "GalleryImage was deleted despite 409");
    pass("DELETE /admin/gallery/:id blocked 409 while in use");

    const detached = await api<{ ok: boolean }>("POST", "/admin/media-usages/detach", {
      token,
      body: attachBody,
    });
    if (detached.status !== 201 && detached.status !== 200) {
      fail("detach", `status ${detached.status} ${JSON.stringify(detached.data)}`);
    }
    pass("detach");

    const checkFree = await api<{ inUse: boolean; count: number }>(
      "GET",
      `/admin/media-usages/media/${mediaId}/deletion-check`,
      { token },
    );
    if (checkFree.status !== 200 || checkFree.data.inUse !== false || checkFree.data.count !== 0) {
      fail("deletionCheck-free", JSON.stringify(checkFree.data));
    }
    pass("deletionCheck inUse=false count=0");

    const image = await prisma.galleryImage.findUnique({ where: { id: mediaId }, select: { id: true } });
    if (!image) fail("gallery-preserved", "GalleryImage missing after detach");
    pass("GalleryImage still exists");
  } finally {
    const leftover = await prisma.mediaUsage.deleteMany({
      where: { usageType: USAGE_TYPE, entityId: ENTITY_ID },
    });
    if (leftover.count > 0) {
      console.log(`CLEANUP deleted ${leftover.count} leftover MediaUsage row(s)`);
    } else {
      console.log("CLEANUP no leftover MediaUsage rows");
    }
    const remaining = await prisma.mediaUsage.count({
      where: { usageType: USAGE_TYPE, entityId: ENTITY_ID },
    });
    if (remaining !== 0) {
      console.error(`CLEANUP FAILED remaining=${remaining}`);
      process.exitCode = 1;
    } else {
      console.log("CLEANUP succeeded remaining=0");
    }
    await prisma.$disconnect();
  }

  console.log("---");
  for (const line of results) console.log(line);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
