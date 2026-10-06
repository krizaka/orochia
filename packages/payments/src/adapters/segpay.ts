import crypto from "crypto";
import {
  PaymentGatewayAdapter,
  CreateCheckoutOptions,
  CheckoutSessionResult,
  ParsedPaymentEvent,
} from "../types";

export interface SegpayConfig {
  merchantId: string;
  packageId: string;
  secretKey: string;
}

export class SegpayAdapter implements PaymentGatewayAdapter {
  readonly gatewayName = "SEGPAY";
  private config: SegpayConfig;

  constructor(config: SegpayConfig) {
    this.config = config;
  }

  async createCheckoutSession(options: CreateCheckoutOptions): Promise<CheckoutSessionResult> {
    const amountInDollars = (options.amountCents / 100).toFixed(2);
    const sessionId = `segpay_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const params = new URLSearchParams({
      mid: this.config.merchantId,
      eticketid: this.config.packageId,
      price: amountInDollars,
      currency: options.currency || "USD",
      custom_creator: options.creatorId,
      custom_video: options.videoId || "",
      custom_sender: options.senderId || "",
      return_url: options.returnUrl,
    });

    const checkoutUrl = `https://secure2.segpay.com/billing/poset.cgi?${params.toString()}`;

    return {
      checkoutUrl,
      sessionId,
      gateway: this.gatewayName,
    };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const signature = headers["x-segpay-signature"];
    if (!signature) {
      return process.env.NODE_ENV !== "production";
    }

    const hash = crypto
      .createHmac("sha256", this.config.secretKey)
      .update(rawBody)
      .digest("hex");

    return hash === signature;
  }

  parseWebhookEvent(payload: Record<string, unknown>): ParsedPaymentEvent {
    const amount = typeof payload.price === "number"
      ? Math.round(payload.price * 100)
      : Math.round(parseFloat(String(payload.price || "0")) * 100);

    return {
      gatewayTransactionRef: String(payload.tranid || payload.transaction_id || `segpay_${Date.now()}`),
      amountCents: amount,
      creatorId: String(payload.custom_creator || ""),
      senderId: payload.custom_sender ? String(payload.custom_sender) : undefined,
      videoId: payload.custom_video ? String(payload.custom_video) : undefined,
      status: payload.action === "declined" ? "FAILED" : "SUCCESS",
      rawEvent: payload,
    };
  }
}
