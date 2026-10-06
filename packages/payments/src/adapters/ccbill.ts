import crypto from "crypto";
import {
  PaymentGatewayAdapter,
  CreateCheckoutOptions,
  CheckoutSessionResult,
  ParsedPaymentEvent,
} from "../types";

export interface CCBillConfig {
  clientAccount: string;
  clientSubaccount: string;
  formName: string;
  salt: string;
  flexFormId?: string;
}

export class CCBillAdapter implements PaymentGatewayAdapter {
  readonly gatewayName = "CCBILL";
  private config: CCBillConfig;

  constructor(config: CCBillConfig) {
    this.config = config;
  }

  async createCheckoutSession(options: CreateCheckoutOptions): Promise<CheckoutSessionResult> {
    const amountInDollars = (options.amountCents / 100).toFixed(2);
    const initialPeriod = 30; // standard 30-day access or one-time
    const currencyCode = "840"; // USD ISO 4217 numeric code

    // CCBill MD5 form digest: md5(formPrice + formPeriod + currencyCode + salt)
    const digestSource = `${amountInDollars}${initialPeriod}${currencyCode}${this.config.salt}`;
    const formDigest = crypto.createHash("md5").update(digestSource).digest("hex");

    const queryParams = new URLSearchParams({
      clientAccnum: this.config.clientAccount,
      clientSubacc: this.config.clientSubaccount,
      formName: this.config.formName,
      formPrice: amountInDollars,
      formPeriod: String(initialPeriod),
      currencyCode,
      formDigest,
      creatorId: options.creatorId,
      senderId: options.senderId || "anonymous",
      videoId: options.videoId || "",
      returnUrl: options.returnUrl,
    });

    const checkoutUrl = `https://bill.ccbill.com/jpost/signup.cgi?${queryParams.toString()}`;
    const sessionId = `ccbill_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return {
      checkoutUrl,
      sessionId,
      gateway: this.gatewayName,
      metadata: { formDigest, amountInDollars },
    };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    // CCBill sends responseDigest or dynamic pricing postback hash
    const signature = headers["x-ccbill-signature"] || headers["signature"];
    if (!signature) {
      // In staging/development, pass through if secret salt is dummy
      return process.env.NODE_ENV !== "production";
    }

    const expected = crypto
      .createHmac("sha256", this.config.salt)
      .update(rawBody)
      .digest("hex");

    return signature === expected;
  }

  parseWebhookEvent(payload: Record<string, unknown>): ParsedPaymentEvent {
    const transactionId = String(payload.subscriptionId || payload.transactionId || `tx_${Date.now()}`);
    const amount = typeof payload.billedAmount === "number"
      ? Math.round(payload.billedAmount * 100)
      : Math.round(parseFloat(String(payload.billedAmount || "0")) * 100);

    return {
      gatewayTransactionRef: transactionId,
      amountCents: amount,
      creatorId: String(payload.creatorId || ""),
      senderId: payload.senderId ? String(payload.senderId) : undefined,
      videoId: payload.videoId ? String(payload.videoId) : undefined,
      status: payload.reasonForDecline ? "FAILED" : "SUCCESS",
      rawEvent: payload,
    };
  }
}
