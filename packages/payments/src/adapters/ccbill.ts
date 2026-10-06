import crypto from "crypto";
import {
  PaymentGatewayAdapter,
  CreateCheckoutOptions,
  CheckoutSessionResult,
  ParsedPaymentEvent,
  requireString,
  dollarsToCents,
} from "../types";
import { header, hmacHex, safeEqual } from "../signature";

export interface CCBillConfig {
  clientAccount: string;
  clientSubaccount: string;
  formName: string;
  salt: string;
  /** Secret shared with the CCBill webhook relay that signs postbacks (HMAC-SHA256). */
  webhookSecret: string;
}

/** CCBill FlexForms (dynamic pricing) — the buyer is redirected to CCBill's hosted form. */
export class CCBillAdapter implements PaymentGatewayAdapter {
  readonly gatewayName = "CCBILL" as const;

  constructor(private readonly config: CCBillConfig) {}

  async createCheckoutSession(options: CreateCheckoutOptions): Promise<CheckoutSessionResult> {
    const formPrice = (options.amountCents / 100).toFixed(2);
    const formPeriod = "2"; // one-time charge: shortest allowed access period
    const currencyCode = "840"; // USD (ISO 4217 numeric)
    // CCBill dynamic pricing digest: md5(formPrice + formPeriod + currencyCode + salt)
    const formDigest = crypto
      .createHash("md5")
      .update(`${formPrice}${formPeriod}${currencyCode}${this.config.salt}`)
      .digest("hex");

    const query = new URLSearchParams({
      clientAccnum: this.config.clientAccount,
      clientSubacc: this.config.clientSubaccount,
      formName: this.config.formName,
      formPrice,
      formPeriod,
      currencyCode,
      formDigest,
      // Custom fields are echoed back on the postback: the intent id is the only one we read.
      orochiaIntentId: options.intentId,
    });

    return {
      checkoutUrl: `https://bill.ccbill.com/jpost/signup.cgi?${query.toString()}`,
      sessionId: options.intentId,
      gateway: this.gatewayName,
    };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const signature = header(headers, "x-ccbill-signature");
    if (!signature || !this.config.webhookSecret) return false;
    return safeEqual(signature, hmacHex("sha256", this.config.webhookSecret, rawBody));
  }

  parseWebhookEvent(payload: Record<string, unknown>): ParsedPaymentEvent {
    const eventType = String(payload.eventType ?? "");
    return {
      intentId: requireString(payload, "orochiaIntentId", "X-orochiaIntentId"),
      gatewayTransactionRef: requireString(payload, "transactionId", "subscriptionId"),
      amountCents: dollarsToCents(payload.billedAmount ?? payload.accountingAmount),
      status: payload.reasonForDecline || eventType === "Denial" ? "FAILED" : "SUCCESS",
    };
  }
}
