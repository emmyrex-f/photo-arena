export type CheckoutInput = {
  reference: string;
  amountKobo: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  returnUrl: string;
  cancelUrl: string;
  /** Hold window in minutes — mirrored to Bachs session expiry when possible. */
  expiresInMinutes?: number;
};

export type CheckoutSession = {
  provider: string;
  checkoutUrl: string;
  reference: string;
  /** Bachs checkout_id (chk_…) when available. */
  providerSessionId?: string;
};

export type PaymentVerification = {
  reference: string;
  success: boolean;
  transactionId?: string;
  providerSessionId?: string;
  /** Provider-reported amount as a decimal string (e.g. "57000.00"), when available. */
  amount?: string;
  /** Provider-reported ISO currency (e.g. "NGN"), when available. */
  currency?: string;
};

export type WebhookParseInput = {
  rawBody: Buffer | string;
  signature?: string;
  signatureV2?: string;
  timestamp?: string;
};

export type PaymentWebhookEvent = {
  eventId: string;
  reference: string;
  /** True only for collection.succeeded, or checkout.completed with data.payment_status === "paid". */
  success: boolean;
  /** Explicit payment failure — mark Payment FAILED. */
  failed: boolean;
  /** Abandoned / expired / underpaid — leave booking unpaid/pending. */
  abandoned: boolean;
  /** Explicit refund event (e.g. refund.paid). */
  refunded?: boolean;
  transactionId?: string;
  providerSessionId?: string;
  /** data.amount as a decimal string (e.g. "57000.00"), when present in the event. */
  amount?: string;
  /** data.currency ISO code, when present in the event. */
  currency?: string;
  rawType: string;
};

/** Thrown by providers when the upstream API rejects a request. Never carries credentials. */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    /** Upstream HTTP status (e.g. 401, 409, 422) when known. */
    readonly upstreamStatus?: number,
    /** Provider machine-readable code (e.g. VALIDATION_ERROR) when the body carries one. */
    readonly providerCode?: string,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}

export interface PaymentProvider {
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutSession>;
  verifyTransaction(input: {
    reference: string;
    providerSessionId?: string | null;
  }): Promise<PaymentVerification>;
  parseWebhook(input: WebhookParseInput): Promise<PaymentWebhookEvent>;
}
