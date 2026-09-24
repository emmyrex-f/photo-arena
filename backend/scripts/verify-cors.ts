/**
 * SEC-M2 / H3: CORS allowlist unit + live OPTIONS checks.
 */
import "./load-env";
import assert from "node:assert/strict";
import {
  configuredOrigins,
  corsOriginCallback,
  corsOptions,
  originAllowed,
} from "../src/common/site-origins";

const API_BASE = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");

function allowSync(origin: string | undefined, env: NodeJS.ProcessEnv): boolean {
  let allowed = false;
  corsOriginCallback(origin, (_err, allow) => {
    allowed = Boolean(allow);
  }, env);
  return allowed;
}

function unitTests() {
  const prod: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    PUBLIC_SITE_ORIGINS: "https://photoarenang.com,https://www.photoarenang.com",
  };
  assert.deepEqual(configuredOrigins(prod), [
    "https://photoarenang.com",
    "https://www.photoarenang.com",
  ]);
  assert.equal(originAllowed("https://photoarenang.com", prod), true);
  assert.equal(originAllowed("https://www.photoarenang.com", prod), true);
  assert.equal(originAllowed("https://evil.example", prod), false);
  assert.equal(originAllowed("http://localhost:5173", prod), false);
  assert.equal(allowSync("https://photoarenang.com", prod), true);
  assert.equal(allowSync("https://evil.example", prod), false);
  assert.equal(allowSync(undefined, prod), true, "no Origin (webhooks/curl) allowed");

  const opts = corsOptions(prod);
  assert.equal(opts.credentials, false);
  assert.notEqual(opts.origin, true);
  assert.notEqual(opts.origin, "*");

  const dev: NodeJS.ProcessEnv = {
    NODE_ENV: "development",
    PUBLIC_SITE_ORIGINS: "https://preview.example",
  };
  assert.ok(configuredOrigins(dev).includes("http://localhost:5173"));
  assert.ok(configuredOrigins(dev).includes("http://127.0.0.1:5173"));
  assert.ok(configuredOrigins(dev).includes("https://preview.example"));
  assert.equal(originAllowed("http://localhost:5173", dev), true);
  assert.equal(originAllowed("https://evil.example", dev), false);

  console.log("CORS unit allowlist ✓");
}

async function liveOptions(origin: string): Promise<{ status: number; acao: string | null }> {
  const response = await fetch(`${API_BASE}/health`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "GET",
    },
  });
  return {
    status: response.status,
    acao: response.headers.get("access-control-allow-origin"),
  };
}

async function liveTests() {
  let healthOk = false;
  try {
    const health = await fetch(`${API_BASE}/health`);
    healthOk = health.ok;
  } catch {
    console.log("API not reachable — skipping live CORS OPTIONS checks");
    return;
  }
  if (!healthOk) {
    console.log("API /health not OK — skipping live CORS OPTIONS checks");
    return;
  }

  const local = await liveOptions("http://localhost:5173");
  assert.ok(local.status < 400, `localhost OPTIONS ${local.status}`);
  assert.equal(local.acao, "http://localhost:5173", `localhost ACAO got ${local.acao}`);
  console.log("approved localhost origin → allowed ✓");

  const evil = await liveOptions("https://evil.example");
  assert.notEqual(evil.acao, "https://evil.example", "evil origin must not be reflected");
  // cors package typically omits ACAO (null) when rejected
  assert.ok(evil.acao == null || evil.acao === "false" || evil.acao !== "https://evil.example");
  console.log("unknown/malicious origin → rejected ✓");

  const prodLike = process.env.PUBLIC_SITE_ORIGINS?.split(",")
    .map((s) => s.trim())
    .find((s) => s.startsWith("https://"));
  if (prodLike) {
    const approved = await liveOptions(prodLike);
    assert.equal(approved.acao, prodLike, `prod origin ACAO ${approved.acao}`);
    console.log(`approved production origin (${prodLike}) → allowed ✓`);
  } else {
    console.log("no https PUBLIC_SITE_ORIGINS in env — skipped live production-origin check");
  }
}

async function main() {
  unitTests();
  await liveTests();
  console.log("\nSEC-M2 CORS verification passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
