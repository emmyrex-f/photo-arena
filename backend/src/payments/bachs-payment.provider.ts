import {
  PaymentProviderError,
  type CheckoutInput,
  type CheckoutSession,
  type PaymentProvider,
  type PaymentVerification,
  type PaymentWebhookEvent,
  type WebhookParseInput,
} from "./payment-provider";
import { bachsHostedRedirectUrl } from "../common/site-origins";
import { parseBachsWebhookEvent } from "./parse-bachs-webhook";

function detectBachsBaseUrl(apiKey: string, configured?: string): string {
  if (apiKey.startsWith("sk_live_")) return "https://api.bachs.io";
  if (configured) return configured;
  return "https://sandbox-api.bachs.io";
}

function toBachsAmount(kobo: number): string {
  return (kobo / 100).toFixed(2);
}

type BachsCheckoutCreateResponse = {
  checkout_id?: string;
  id?: string;
  checkout_url?: string;
  url?: string;
  reference?: string | null;
  status?: string;
  payment_status?: string;
};

/** GET /v1/checkout-sessions/{id} — fields we read (docs.bachs.io/api-reference/checkout-sessions/get-checkout-session). */
type BachsCheckoutGetResponse = {
  checkout_id?: string;
  id?: string;
  reference?: string | null;
  /** open | completed | expired | cancelled */
  status?: string;
  /** requires_payment_method | … | processing | succeeded | failed | canceled */
  payment_status?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  charge?: {
    payment_id?: string;
    status?: string;
    amount?: string | number | null;
    currency?: string | null;
  } | null;
  metadata?: { reference?: string; booking_reference?: string } | null;
};

function isPaidStatus(status?: string | null): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return normalized === "succeeded" || normalized === "success" || normalized === "completed";
}

function asDecimalString(value: string | number | null | undefined): string | undefined {
  if (value == null) return undefined;
  const text = typeof value === "number" ? String(value) : value.trim();
  return text ? text : undefined;
}

/** Bachs error envelope: `{ detail, error_code, errors[] }` (api-reference/error-reference). */
type BachsErrorBody = {
  detail?: string;
  error_code?: string;
  errors?: Array<{ field?: string; message?: string }> | null;
};

/**
 * Credential-free summary of an upstream error. Reads Bachs's own `detail` / `error_code` /
 * field errors so a rejection names its cause; falls back to a trimmed body for non-JSON.
 */
function summarizeUpstreamBody(text: string): { message: string; code?: string } {
  try {
    const body = JSON.parse(text) as BachsErrorBody;
    const fields = (body.errors ?? [])
      .map((e) => [e.field, e.message].filter(Boolean).join(": "))
      .filter(Boolean);
    const parts = [body.detail, ...fields].filter(Boolean) as string[];
    if (parts.length) return { message: parts.join(" · "), code: body.error_code };
  } catch {
    /* not JSON — fall through */
  }
  const trimmed = text.replace(/\s+/g, " ").trim();
  return { message: trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed };
}

export class BachsPaymentProvider implements PaymentProvider {
  constructor(
    private readonly apiKey: string,
    private readonly webhookSecret: string,
    configuredBaseUrl?: string,
  ) {
    this.baseUrl = detectBachsBaseUrl(apiKey, configuredBaseUrl);
  }

  private readonly baseUrl: string;

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
    const amount = toBachsAmount(input.amountKobo);
    const successUrl = bachsHostedRedirectUrl(input.returnUrl);
    const cancelUrl = bachsHostedRedirectUrl(input.cancelUrl);
    const body: Record<string, unknown> = {
      customer: {
        email: input.customerEmail,
        name: input.customerName,
        ...(input.customerPhone ? { phone_number: input.customerPhone } : {}),
      },
      reference: input.reference,
      billing_currency: input.currency,
      metadata: {
        reference: input.reference,
        booking_reference: input.reference,
      },
      pricing: {
        amount,
        currency: input.currency,
      },
    };
    if (successUrl) body.success_url = successUrl;
    if (cancelUrl) body.cancel_url = cancelUrl;
    if (input.expiresInMinutes) {
      body.expires_in_minutes = Math.min(1440, Math.max(1, input.expiresInMinutes));
    }

    if (!this.apiKey) {
      throw new PaymentProviderError("Bachs API key is not configured");
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/checkout-sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Idempotency-Key": input.reference,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new PaymentProviderError(
        `Bachs checkout request failed: ${error instanceof Error ? error.message : "network error"}`,
      );
    }

    if (!response.ok) {
      const upstream = summarizeUpstreamBody(await response.text());
      throw new PaymentProviderError(
        `Bachs checkout rejected (${response.status}${upstream.code ? ` ${upstream.code}` : ""}): ${upstream.message}`,
        response.status,
        upstream.code,
      );
    }

    const data = (await response.json()) as BachsCheckoutCreateResponse;
    const checkoutUrl = data.checkout_url ?? data.url ?? "";
    if (!checkoutUrl) {
      throw new PaymentProviderError("Bachs checkout did not return a checkout_url", response.status);
    }

    return {
      provider: "bachs",
      checkoutUrl,
      reference: data.reference ?? input.reference,
      providerSessionId: data.checkout_id ?? data.id,
    };
  }

  async verifyTransaction(input: {
    reference: string;
    providerSessionId?: string | null;
  }): Promise<PaymentVerification> {
    const sessionKey = input.providerSessionId?.trim();
    if (!sessionKey) {
      return { reference: input.reference, success: false };
    }

    if (!this.apiKey) {
      return { reference: input.reference, success: false, providerSessionId: sessionKey };
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/v1/checkout-sessions/${encodeURIComponent(sessionKey)}`, {
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: "application/json" },
      });
    } catch {
      // Network failure → not verified. The webhook remains the authority.
      return { reference: input.reference, success: false, providerSessionId: sessionKey };
    }
    if (!response.ok) {
      return { reference: input.reference, success: false, providerSessionId: sessionKey };
    }

    const data = (await response.json()) as BachsCheckoutGetResponse;
    const success =
      isPaidStatus(data.payment_status) ||
      isPaidStatus(data.status) ||
      isPaidStatus(data.charge?.status);

    return {
      reference: data.reference ?? data.metadata?.reference ?? input.reference,
      success,
      transactionId: data.charge?.payment_id ?? data.checkout_id ?? data.id,
      providerSessionId: data.checkout_id ?? data.id ?? sessionKey,
      amount: asDecimalString(data.charge?.amount) ?? asDecimalString(data.amount),
      currency: (data.charge?.currency ?? data.currency)?.trim().toUpperCase() || undefined,
    };
  }

  async parseWebhook(input: WebhookParseInput): Promise<PaymentWebhookEvent> {
    return parseBachsWebhookEvent(input, this.webhookSecret);
  }
}
