/**
 * M4A diagnostic: Bachs DNS / TLS / HTTPS / auth. Never prints secrets.
 */
import "./load-env";
import { lookup } from "node:dns/promises";
import { connect as tlsConnect } from "node:tls";
import { request as httpsRequest } from "node:https";

function classifyKey(raw: string): string {
  const key = raw.trim();
  if (!key) return "missing";
  if (key.startsWith("sk_sandbox_")) return "configured (sk_sandbox_ prefix)";
  if (key.startsWith("sk_live_")) return "configured (sk_live_ prefix)";
  if (key.startsWith("sk_")) return "malformed (unknown sk_ prefix)";
  return "malformed (not a Bachs secret-key prefix)";
}

function classifySecret(raw: string): string {
  const value = raw.trim();
  if (!value) return "missing";
  if (value.startsWith("whsec_")) return "configured (whsec_ prefix)";
  return "configured (non-whsec prefix)";
}

function detectBaseUrl(apiKey: string, configured?: string): string {
  if (apiKey.trim().startsWith("sk_live_")) return "https://api.bachs.io";
  if (configured?.trim()) return configured.trim().replace(/\/$/, "");
  return "https://sandbox-api.bachs.io";
}

function causeOf(error: unknown): Record<string, string | undefined> {
  const err = error as Error & { code?: string; cause?: Error & { code?: string } };
  return {
    name: err?.name,
    message: err?.message,
    code: err?.code,
    causeName: err?.cause?.name,
    causeMessage: err?.cause?.message,
    causeCode: err?.cause?.code,
  };
}

function tlsProbe(hostname: string, port = 443): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const socket = tlsConnect({ host: hostname, port, servername: hostname, timeout: 8000 }, () => {
      resolve({
        ok: true,
        authorized: socket.authorized,
        protocol: socket.getProtocol(),
        alpn: socket.alpnProtocol,
        authorizationError: socket.authorizationError || null,
      });
      socket.end();
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, error: "timeout" });
    });
    socket.on("error", (error) => {
      resolve({ ok: false, ...causeOf(error) });
    });
  });
}

function httpsGet(url: string, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const req = httpsRequest(
      url,
      { method: "GET", headers, timeout: 10000 },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8").replace(/\s+/g, " ").trim();
          const redacted = /sk_|whsec_|Bearer\s+\S+/i.test(text) ? "[redacted]" : text.slice(0, 180);
          resolve({
            ok: true,
            status: res.statusCode,
            contentType: res.headers["content-type"],
            bodyPreview: redacted,
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });
    req.on("error", (error) => resolve({ ok: false, ...causeOf(error) }));
    req.end();
  });
}

async function main() {
  const apiKey = process.env.BACHS_API_KEY ?? "";
  const webhookSecret = process.env.BACHS_WEBHOOK_SECRET ?? "";
  const configuredBase = process.env.BACHS_BASE_URL ?? "";
  const paymentsMock = process.env.PAYMENTS_MOCK ?? "";
  const nodeEnv = process.env.NODE_ENV ?? "";
  const publicApi = process.env.PUBLIC_API_URL ?? "";
  const siteOrigins = process.env.PUBLIC_SITE_ORIGINS ?? "";
  const baseUrl = detectBaseUrl(apiKey, configuredBase);
  const host = new URL(baseUrl).hostname;

  console.log("CONFIG");
  console.log("  NODE_ENV:", nodeEnv || "(unset)");
  console.log("  PAYMENTS_MOCK:", paymentsMock || "(unset)");
  console.log("  BACHS_API_KEY:", classifyKey(apiKey), "length", apiKey.trim().length);
  console.log("  BACHS_WEBHOOK_SECRET:", classifySecret(webhookSecret), "length", webhookSecret.trim().length);
  console.log("  BACHS_BASE_URL configured:", configuredBase.trim() || "(unset)");
  console.log("  resolved API base:", baseUrl);
  console.log("  PUBLIC_API_URL:", publicApi.trim() || "(unset)");
  console.log("  PUBLIC_SITE_ORIGINS:", siteOrigins.trim() || "(unset)");
  console.log("  checkout endpoint:", `${baseUrl}/v1/checkout-sessions`);
  console.log("  webhook path: POST /api/payments/webhook/bachs");

  console.log("\nDNS");
  try {
    const a = await lookup(host, { all: true });
    console.log(
      "  ",
      host,
      a.map((row) => `${row.family === 6 ? "AAAA" : "A"} ${row.address}`).join(", ") || "(no records)",
    );
  } catch (error) {
    console.log("  lookup failed", causeOf(error));
  }

  console.log("\nTLS");
  console.log("  ", await tlsProbe(host));

  console.log("\nHTTPS unauthenticated GET /");
  console.log("  ", await httpsGet(`${baseUrl}/`));

  console.log("\nHTTPS unauthenticated GET /v1/checkout-sessions/chk_m4a_probe");
  console.log("  ", await httpsGet(`${baseUrl}/v1/checkout-sessions/chk_m4a_probe`));

  const key = apiKey.trim();
  if (!key) {
    console.log("\nAUTHENTICATED GET skipped: API key missing");
  } else {
    console.log("\nAUTHENTICATED GET /v1/checkout-sessions/chk_m4a_probe");
    console.log(
      "  ",
      await httpsGet(`${baseUrl}/v1/checkout-sessions/chk_m4a_probe`, {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      }),
    );

    console.log("\nUNDICI/FETCH GET /v1/checkout-sessions/chk_m4a_probe (same client as Photo Arena)");
    try {
      const response = await fetch(`${baseUrl}/v1/checkout-sessions/chk_m4a_probe`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      });
      const text = await response.text();
      const redacted = /sk_|whsec_|Bearer\s+\S+/i.test(text)
        ? "[redacted]"
        : text.replace(/\s+/g, " ").trim().slice(0, 220);
      console.log("  status", response.status, "body", redacted);
    } catch (error) {
      console.log("  fetch failed", causeOf(error));
    }
  }

  const apiBase = (process.env.API_BASE ?? "http://localhost:3001/api").replace(/\/$/, "");
  console.log("\nPHOTO ARENA CHECKOUT (running API)");
  try {
    const packagesRes = await fetch(`${apiBase}/bookings/packages`);
    const packages = (await packagesRes.json()) as Array<{
      packages: Array<{ id: string; durationMinutes: number }>;
    }>;
    const pkg = packages[0]?.packages?.[0];
    if (!pkg) {
      console.log("  no public package available");
      return;
    }
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(Date.now() + 2 * 86_400_000));
    const availRes = await fetch(
      `${apiBase}/bookings/availability?date=${encodeURIComponent(date)}&durationMinutes=${pkg.durationMinutes}`,
    );
    const avail = (await availRes.json()) as { slots?: string[] };
    const slot = avail.slots?.[0];
    if (!slot) {
      console.log("  no open slot");
      return;
    }
    const holdRes = await fetch(`${apiBase}/bookings/hold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageId: pkg.id,
        startTime: slot,
        customerName: "M4A Diagnostic",
        customerPhone: `0803${String(Date.now()).slice(-7)}`,
        customerEmail: "m4a-diagnostic@example.com",
      }),
    });
    const hold = (await holdRes.json()) as { bookingId?: string; reference?: string; statusCode?: number };
    if (!hold.bookingId || !hold.reference) {
      console.log("  hold failed", holdRes.status, hold.statusCode ?? "no bookingId");
      return;
    }
    const checkoutRes = await fetch(`${apiBase}/bookings/${hold.bookingId}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference: hold.reference,
        returnUrl: "http://localhost:5173/book/confirmation",
        cancelUrl: "http://localhost:5173/book?cancelled=1",
      }),
    });
    const checkout = (await checkoutRes.json()) as {
      provider?: string;
      checkoutUrl?: string;
      message?: string;
      providerError?: string;
    };
    const urlKind = checkout.checkoutUrl
      ? checkout.checkoutUrl.startsWith("https://")
        ? "https hosted url present"
        : "non-https url present"
      : "absent";
    console.log("  checkout HTTP", checkoutRes.status);
    console.log("  provider", checkout.provider ?? "(none)");
    console.log("  checkoutUrl", urlKind);
    if (checkout.message) console.log("  message", checkout.message);
    if (checkout.providerError) console.log("  providerError", checkout.providerError);
  } catch (error) {
    console.log("  local API probe failed", causeOf(error));
  }
}

main().catch((error) => {
  console.error("diagnostic crashed", causeOf(error));
  process.exitCode = 1;
});
