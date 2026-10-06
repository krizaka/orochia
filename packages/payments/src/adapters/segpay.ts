import {
  PaymentGatewayAdapter,
  CreateCheckoutOptions,
  CheckoutSessionResult,
  ParsedPaymentEvent,
  requireString,
  dollarsToCents,
} from "../types";
import { header, hmacHex, safeEqual } from "../signature";

export interface SegpayConfig {
  merchantId: string;
  packageId: string;
  secretKey: string;
}

/** Segpay hosted payment page with dynamic pricing; postbacks signed with HMAC-SHA256. */
export class SegpayAdapter implements PaymentGatewayAdapter {
  readonly gatewayName = "SEGPAY" as const;

  constructor(private readonly config: SegpayConfig) {}

  async createCheckoutSession(options: CreateCheckoutOptions): Promise<CheckoutSessionResult> {
    const query = new URLSearchParams({
      "x-eticketid": `${this.config.merchantId}:${this.config.packageId}`,
      amount: (options.amountCents / 100).toFixed(2),
      "x-desc": options.description,
      "x-auth-link": options.returnUrl,
      "x-decl-link": options.cancelUrl,
      // Echoed back on the postback as `orochia_intent`.
      orochia_intent: options.intentId,
    });
    return {
      checkoutUrl: `https://secure2.segpay.com/billing/poset.cgi?${query.toString()}`,
      sessionId: options.intentId,
      gateway: this.gatewayName,
    };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const signature = header(headers, "x-segpay-signature");
    if (!signature || !this.config.secretKey) return false;
    return safeEqual(signature, hmacHex("sha256", this.config.secretKey, rawBody));
  }

  parseWebhookEvent(payload: Record<string, unknown>): ParsedPaymentEvent {
    const action = String(payload.action ?? "").toLowerCase();
    return {
      intentId: requireString(payload, "orochia_intent"),
      gatewayTransactionRef: requireString(payload, "tranid", "transaction_id"),
      amountCents: dollarsToCents(payload.price ?? payload.amount),
      status: action === "auth" || action === "approved" ? "SUCCESS" : action === "pending" ? "PENDING" : "FAILED",
    };
  }
}
