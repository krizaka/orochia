import crypto from "crypto";
import {
  PaymentGatewayAdapter,
  CreateCheckoutOptions,
  CheckoutSessionResult,
  ParsedPaymentEvent,
} from "../types";

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
}

export class StripeAdapter implements PaymentGatewayAdapter {
  readonly gatewayName = "STRIPE";
  private config: StripeConfig;

  constructor(config: StripeConfig) {
    this.config = config;
  }

  async createCheckoutSession(options: CreateCheckoutOptions): Promise<CheckoutSessionResult> {
    const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const checkoutUrl = `https://checkout.stripe.com/c/pay/${sessionId}`;

    return {
      checkoutUrl,
      sessionId,
      gateway: this.gatewayName,
      metadata: {
        creatorId: options.creatorId,
        videoId: options.videoId,
        senderId: options.senderId,
      },
    };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const signature = headers["stripe-signature"];
    if (!signature) {
      return process.env.NODE_ENV !== "production";
    }

    // Stripe signature format: t=timestamp,v1=signature
    const elements = signature.split(",");
    const timestampElem = elements.find((e) => e.startsWith("t="));
    const v1Elem = elements.find((e) => e.startsWith("v1="));

    if (!timestampElem || !v1Elem) {
      return process.env.NODE_ENV !== "production";
    }

    const timestamp = timestampElem.substring(2);
    const v1 = v1Elem.substring(3);
    const signedPayload = `${timestamp}.${rawBody}`;

    const expected = crypto
      .createHmac("sha256", this.config.webhookSecret)
      .update(signedPayload)
      .digest("hex");

    return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  }

  parseWebhookEvent(payload: Record<string, unknown>): ParsedPaymentEvent {
    const dataObject = (payload.data as Record<string, unknown>)?.object as Record<string, unknown> || {};
    const metadata = (dataObject.metadata as Record<string, unknown>) || {};

    const amount = typeof dataObject.amount === "number" ? dataObject.amount : 0;

    return {
      gatewayTransactionRef: String(dataObject.id || `st_${Date.now()}`),
      amountCents: amount,
      creatorId: String(metadata.creatorId || ""),
      senderId: metadata.senderId ? String(metadata.senderId) : undefined,
      videoId: metadata.videoId ? String(metadata.videoId) : undefined,
      status: dataObject.status === "succeeded" || payload.type === "checkout.session.completed" ? "SUCCESS" : "PENDING",
      rawEvent: payload,
    };
  }
}
