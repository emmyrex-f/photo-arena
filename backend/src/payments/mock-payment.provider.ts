import type {
  CheckoutInput,
  CheckoutSession,
  PaymentProvider,
  PaymentVerification,
  PaymentWebhookEvent,
  WebhookParseInput,
} from "./payment-provider";
import { parseBachsWebhookEvent } from "./parse-bachs-webhook";

/**
 * Development only. Never presented as a live Bachs charge.
 * When `webhookSecret` is set, accepts signed Bachs-shaped webhooks so Step 11
 * (success / fail / abandon / duplicate) can run locally without a sandbox key.
 */
export class MockPaymentProvider implements PaymentProvider {
  private readonly completed = new Set<string>();

  constructor(private readonly webhookSecret = "") {}

  markCompleted(reference: string) {
    this.completed.add(reference);
  }

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession> {
    return {
      provider: "mock",
      checkoutUrl: `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}mock=1&reference=${encodeURIComponent(input.reference)}`,
      reference: input.reference,
      providerSessionId: `mock_${input.reference}`,
    };
  }

  async verifyTransaction(input: {
    reference: string;
    providerSessionId?: string | null;
  }): Promise<PaymentVerification> {
    return {
      reference: input.reference,
      success: this.completed.has(input.reference),
      providerSessionId: input.providerSessionId ?? undefined,
    };
  }

  async parseWebhook(input: WebhookParseInput): Promise<PaymentWebhookEvent> {
    if (!this.webhookSecret) {
      throw new Error("Mock provider does not accept webhooks without BACHS_WEBHOOK_SECRET");
    }
    return parseBachsWebhookEvent(input, this.webhookSecret);
  }
}
