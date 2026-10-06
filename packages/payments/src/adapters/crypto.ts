import crypto from "crypto";
import {
  PaymentGatewayAdapter,
  CreateCheckoutOptions,
  CheckoutSessionResult,
  ParsedPaymentEvent,
} from "../types";

export interface CryptoGatewayConfig {
  apiKey: string;
  ipnSecret: string;
}

export class CryptoGatewayAdapter implements PaymentGatewayAdapter {
  readonly gatewayName = "CRYPTO";
  private config: CryptoGatewayConfig;

  constructor(config: CryptoGatewayConfig) {
    this.config = config;
  }

  async createCheckoutSession(options: CreateCheckoutOptions): Promise<CheckoutSessionResult> {
    const amountInDollars = (options.amountCents / 100).toFixed(2);
    const orderId = `crypto_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // In a live integration, calls NowPayments / BTCPay REST API:
    // POST /v1/invoice
    const checkoutUrl = `https://nowpayments.io/payment/?iid=${orderId}&price_amount=${amountInDollars}&price_currency=usd`;

    return {
      checkoutUrl,
      sessionId: orderId,
      gateway: this.gatewayName,
      metadata: {
        creatorId: options.creatorId,
        videoId: options.videoId,
        orderId,
      },
    };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const signature = headers["x-nowpayments-sig"] || headers["x-btcpay-sig"];
    if (!signature) {
      return process.env.NODE_ENV !== "production";
    }

    const calculatedSig = crypto
      .createHmac("sha512", this.config.ipnSecret)
      .update(rawBody)
      .digest("hex");

    return calculatedSig === signature;
  }

  parseWebhookEvent(payload: Record<string, unknown>): ParsedPaymentEvent {
    const amount = typeof payload.price_amount === "number"
      ? Math.round(payload.price_amount * 100)
      : Math.round(parseFloat(String(payload.price_amount || "0")) * 100);

    const isFinished = payload.payment_status === "finished" || payload.payment_status === "confirmed";

    return {
      gatewayTransactionRef: String(payload.payment_id || `crypto_${Date.now()}`),
      amountCents: amount,
      creatorId: String(payload.order_description || payload.creator_id || ""),
      senderId: payload.sender_id ? String(payload.sender_id) : undefined,
      videoId: payload.video_id ? String(payload.video_id) : undefined,
      status: isFinished ? "SUCCESS" : "PENDING",
      rawEvent: payload,
    };
  }
}
