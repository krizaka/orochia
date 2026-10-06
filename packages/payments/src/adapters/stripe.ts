import {
  PaymentGatewayAdapter,
  CreateCheckoutOptions,
  CheckoutSessionResult,
  ParsedPaymentEvent,
  InvalidPaymentEventError,
  requireString,
} from "../types";
import { header, hmacHex, safeEqual } from "../signature";

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  /** Maximum age of a signed webhook, in seconds (replay protection). */
  toleranceSeconds?: number;
}

/** Stripe Checkout Sessions over the REST API; webhooks verified per Stripe's v1 scheme. */
export class StripeAdapter implements PaymentGatewayAdapter {
  readonly gatewayName = "STRIPE" as const;

  constructor(
    private readonly config: StripeConfig,
    private readonly http: typeof fetch = fetch,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async createCheckoutSession(options: CreateCheckoutOptions): Promise<CheckoutSessionResult> {
    const form = new URLSearchParams({
      mode: "payment",
      client_reference_id: options.intentId,
      "metadata[intentId]": options.intentId,
      success_url: options.returnUrl,
      cancel_url: options.cancelUrl,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": options.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(options.amountCents),
      "line_items[0][price_data][product_data][name]": options.description,
    });
    const response = await this.http("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": options.intentId,
      },
      body: form.toString(),
    });
    if (!response.ok) {
      throw new Error(`Stripe refused the checkout session (HTTP ${response.status})`);
    }
    const session = (await response.json()) as { id?: string; url?: string };
    if (!session.id || !session.url) throw new Error("Stripe returned no checkout URL");
    return { checkoutUrl: session.url, sessionId: session.id, gateway: this.gatewayName };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const signature = header(headers, "stripe-signature");
    if (!signature || !this.config.webhookSecret) return false;
    const parts = signature.split(",").map((p) => p.trim());
    const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
    const candidates = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
    if (!timestamp || candidates.length === 0 || !/^\d+$/.test(timestamp)) return false;
    const age = Math.abs(this.now() / 1000 - Number(timestamp));
    if (age > (this.config.toleranceSeconds ?? 300)) return false;
    const expected = hmacHex("sha256", this.config.webhookSecret, `${timestamp}.${rawBody}`);
    return candidates.some((candidate) => safeEqual(candidate, expected));
  }

  parseWebhookEvent(payload: Record<string, unknown>): ParsedPaymentEvent {
    const type = String(payload.type ?? "");
    const session = ((payload.data as Record<string, unknown> | undefined)?.object ?? {}) as Record<
      string,
      unknown
    >;
    if (!type.startsWith("checkout.session.")) {
      throw new InvalidPaymentEventError(`unsupported Stripe event ${type}`);
    }
    const paid = type === "checkout.session.completed" && session.payment_status === "paid";
    const asyncPaid = type === "checkout.session.async_payment_succeeded";
    const failed = type === "checkout.session.async_payment_failed" || type === "checkout.session.expired";
    const amount = Number(session.amount_total);
    if (!Number.isInteger(amount) || amount < 0) {
      throw new InvalidPaymentEventError("missing amount_total");
    }
    return {
      intentId: requireString(session, "client_reference_id"),
      gatewayTransactionRef: String(session.payment_intent ?? requireString(session, "id")),
      amountCents: amount,
      status: paid || asyncPaid ? "SUCCESS" : failed ? "FAILED" : "PENDING",
    };
  }
}
