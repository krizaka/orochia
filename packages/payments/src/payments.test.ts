import { describe, expect, it, vi } from "vitest";
import {
  CCBillAdapter,
  CryptoGatewayAdapter,
  SegpayAdapter,
  StripeAdapter,
  configuredGateways,
  getPaymentGateway,
  GatewayConfigurationError,
  InvalidPaymentEventError,
  hmacHex,
  safeEqual,
  sortedJson,
  splitPlatformFee,
  platformFeePercent,
} from "./index";

const INTENT = "3f2b8c1e-5a7d-4e2f-9b1c-8d7e6f5a4b3c";

describe("signature helpers", () => {
  it("compares in constant time and refuses length mismatches", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("sorts keys recursively", () => {
    expect(sortedJson({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } })).toBe('{"a":{"c":[3,{"e":0,"f":1}],"d":2},"b":1}');
  });
});

describe("platform fee", () => {
  it("splits gross into fee and net that always add up", () => {
    expect(splitPlatformFee(1000, 10)).toEqual({ platformFeeCents: 100, netAmountCents: 900 });
    const odd = splitPlatformFee(333, 10);
    expect(odd.platformFeeCents + odd.netAmountCents).toBe(333);
  });

  it("refuses non-positive or fractional amounts and absurd percentages", () => {
    expect(() => splitPlatformFee(0, 10)).toThrow();
    expect(() => splitPlatformFee(10.5, 10)).toThrow();
    expect(() => platformFeePercent({ PLATFORM_FEE_PERCENTAGE: "150" })).toThrow();
    expect(platformFeePercent({})).toBe(10);
  });
});

describe("CCBill", () => {
  const adapter = new CCBillAdapter({
    clientAccount: "950000",
    clientSubaccount: "0000",
    formName: "form",
    salt: "salt",
    webhookSecret: "hook",
  });

  it("verifies postbacks strictly — no leniency for a missing signature", () => {
    const body = "transactionId=1";
    expect(adapter.verifyWebhookSignature(body, { "X-CCBill-Signature": hmacHex("sha256", "hook", body) })).toBe(true);
    expect(adapter.verifyWebhookSignature(body, {})).toBe(false);
    expect(adapter.verifyWebhookSignature(body, { "x-ccbill-signature": "deadbeef" })).toBe(false);
  });

  it("carries the intent id to the hosted form and reads it back", async () => {
    const session = await adapter.createCheckoutSession({
      intentId: INTENT,
      amountCents: 1250,
      currency: "USD",
      description: "Unlock",
      returnUrl: "https://app/ok",
      cancelUrl: "https://app/ko",
    });
    expect(new URL(session.checkoutUrl).searchParams.get("orochiaIntentId")).toBe(INTENT);
    expect(new URL(session.checkoutUrl).searchParams.get("formPrice")).toBe("12.50");
    const event = adapter.parseWebhookEvent({ orochiaIntentId: INTENT, transactionId: "tx1", billedAmount: "12.50" });
    expect(event).toEqual({ intentId: INTENT, gatewayTransactionRef: "tx1", amountCents: 1250, status: "SUCCESS" });
  });

  it("refuses an event without a transaction reference instead of inventing one", () => {
    expect(() => adapter.parseWebhookEvent({ orochiaIntentId: INTENT, billedAmount: "1" })).toThrow(InvalidPaymentEventError);
  });
});

describe("Segpay", () => {
  const adapter = new SegpayAdapter({ merchantId: "m", packageId: "p", secretKey: "k" });
  it("treats only approvals as payments", () => {
    expect(adapter.parseWebhookEvent({ orochia_intent: INTENT, tranid: "t", price: "5", action: "auth" }).status).toBe("SUCCESS");
    expect(adapter.parseWebhookEvent({ orochia_intent: INTENT, tranid: "t", price: "5", action: "declined" }).status).toBe("FAILED");
  });
});

describe("NowPayments", () => {
  it("verifies the HMAC-SHA512 of the key-sorted body", () => {
    const adapter = new CryptoGatewayAdapter({ apiKey: "k", ipnSecret: "ipn", callbackUrl: "https://app/cb" });
    const payload = { payment_status: "finished", order_id: INTENT, payment_id: 42, price_amount: 10 };
    const raw = JSON.stringify(payload);
    const sig = hmacHex("sha512", "ipn", sortedJson(payload));
    expect(adapter.verifyWebhookSignature(raw, { "x-nowpayments-sig": sig })).toBe(true);
    expect(adapter.verifyWebhookSignature(raw.replace("10", "1000"), { "x-nowpayments-sig": sig })).toBe(false);
    expect(adapter.parseWebhookEvent(payload)).toEqual({
      intentId: INTENT,
      gatewayTransactionRef: "42",
      amountCents: 1000,
      status: "SUCCESS",
    });
  });

  it("creates a real invoice through the API", async () => {
    const http = vi.fn(async () => new Response(JSON.stringify({ id: 99, invoice_url: "https://nowpayments.io/payment/?iid=99" })));
    const adapter = new CryptoGatewayAdapter({ apiKey: "key", ipnSecret: "ipn", callbackUrl: "https://app/cb" }, http as unknown as typeof fetch);
    const session = await adapter.createCheckoutSession({
      intentId: INTENT, amountCents: 500, currency: "USD", description: "d", returnUrl: "r", cancelUrl: "c",
    });
    expect(session).toEqual({ checkoutUrl: "https://nowpayments.io/payment/?iid=99", sessionId: "99", gateway: "CRYPTO" });
    const [, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ order_id: INTENT, price_amount: 5 });
  });
});

describe("Stripe", () => {
  const now = 1_790_000_000_000;
  const adapter = new StripeAdapter({ secretKey: "sk", webhookSecret: "whsec" }, fetch, () => now);
  const body = JSON.stringify({ type: "checkout.session.completed" });
  const header = (t: number) => `t=${t},v1=${hmacHex("sha256", "whsec", `${t}.${body}`)}`;

  it("verifies v1 signatures within the tolerance window only", () => {
    expect(adapter.verifyWebhookSignature(body, { "stripe-signature": header(now / 1000) })).toBe(true);
    expect(adapter.verifyWebhookSignature(body, { "stripe-signature": header(now / 1000 - 3600) })).toBe(false);
    expect(adapter.verifyWebhookSignature(body, { "stripe-signature": "t=1,v1=" })).toBe(false);
    expect(adapter.verifyWebhookSignature(body, {})).toBe(false);
  });

  it("settles a paid checkout session on its client reference", () => {
    const event = adapter.parseWebhookEvent({
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", payment_intent: "pi_1", client_reference_id: INTENT, amount_total: 1500, payment_status: "paid" } },
    });
    expect(event).toEqual({ intentId: INTENT, gatewayTransactionRef: "pi_1", amountCents: 1500, status: "SUCCESS" });
    expect(() => adapter.parseWebhookEvent({ type: "invoice.paid", data: { object: {} } })).toThrow(InvalidPaymentEventError);
  });

  it("creates the session over the REST API with the intent as idempotency key", async () => {
    const http = vi.fn(async () => new Response(JSON.stringify({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" })));
    const stripe = new StripeAdapter({ secretKey: "sk_live", webhookSecret: "w" }, http as unknown as typeof fetch);
    await stripe.createCheckoutSession({ intentId: INTENT, amountCents: 700, currency: "USD", description: "d", returnUrl: "r", cancelUrl: "c" });
    const [url, init] = http.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe(INTENT);
    expect(new URLSearchParams(String(init.body)).get("client_reference_id")).toBe(INTENT);
  });
});

describe("gateway factory", () => {
  it("never falls back to placeholder credentials", () => {
    expect(() => getPaymentGateway("STRIPE", {})).toThrow(GatewayConfigurationError);
    expect(configuredGateways({})).toEqual([]);
    expect(configuredGateways({ STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh" })).toEqual(["STRIPE"]);
  });
});
