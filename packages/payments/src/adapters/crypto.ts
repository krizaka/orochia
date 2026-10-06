import {
  PaymentGatewayAdapter,
  CreateCheckoutOptions,
  CheckoutSessionResult,
  ParsedPaymentEvent,
  requireString,
  dollarsToCents,
} from "../types";
import { header, hmacHex, safeEqual, sortedJson } from "../signature";

export interface CryptoGatewayConfig {
  apiKey: string;
  ipnSecret: string;
  callbackUrl: string;
  apiBaseUrl?: string;
}

/** NowPayments invoices; IPN callbacks signed with HMAC-SHA512 over the key-sorted JSON body. */
export class CryptoGatewayAdapter implements PaymentGatewayAdapter {
  readonly gatewayName = "CRYPTO" as const;

  constructor(
    private readonly config: CryptoGatewayConfig,
    private readonly http: typeof fetch = fetch,
  ) {}

  async createCheckoutSession(options: CreateCheckoutOptions): Promise<CheckoutSessionResult> {
    const response = await this.http(`${this.config.apiBaseUrl ?? "https://api.nowpayments.io"}/v1/invoice`, {
      method: "POST",
      headers: { "x-api-key": this.config.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: options.amountCents / 100,
        price_currency: options.currency.toLowerCase(),
        order_id: options.intentId,
        order_description: options.description,
        ipn_callback_url: this.config.callbackUrl,
        success_url: options.returnUrl,
        cancel_url: options.cancelUrl,
      }),
    });
    if (!response.ok) {
      throw new Error(`NowPayments refused the invoice (HTTP ${response.status})`);
    }
    const invoice = (await response.json()) as { id?: string | number; invoice_url?: string };
    if (!invoice.invoice_url || invoice.id === undefined) {
      throw new Error("NowPayments returned no invoice URL");
    }
    return { checkoutUrl: invoice.invoice_url, sessionId: String(invoice.id), gateway: this.gatewayName };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const signature = header(headers, "x-nowpayments-sig");
    if (!signature || !this.config.ipnSecret) return false;
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return false;
    }
    return safeEqual(signature, hmacHex("sha512", this.config.ipnSecret, sortedJson(body)));
  }

  parseWebhookEvent(payload: Record<string, unknown>): ParsedPaymentEvent {
    const status = String(payload.payment_status ?? "");
    return {
      intentId: requireString(payload, "order_id"),
      gatewayTransactionRef: requireString(payload, "payment_id"),
      amountCents: dollarsToCents(payload.price_amount),
      status:
        status === "finished" || status === "confirmed"
          ? "SUCCESS"
          : status === "failed" || status === "expired" || status === "refunded"
            ? "FAILED"
            : "PENDING",
    };
  }
}
