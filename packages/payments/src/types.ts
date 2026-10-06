import { z } from "zod";

export const GatewayTypeSchema = z.enum(["CCBILL", "SEGPAY", "CRYPTO", "STRIPE"]);
export type GatewayType = z.infer<typeof GatewayTypeSchema>;

/** A gateway is not configured for this deployment (missing credentials). */
export class GatewayConfigurationError extends Error {
  constructor(gateway: string, missing: string[]) {
    super(`Payment gateway ${gateway} is not configured (missing: ${missing.join(", ")})`);
    this.name = "GatewayConfigurationError";
  }
}

/** A webhook payload that does not carry what settlement needs. */
export class InvalidPaymentEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPaymentEventError";
  }
}

export interface CreateCheckoutOptions {
  /** The platform's payment intent id — the only reference the webhook is matched on. */
  intentId: string;
  amountCents: number;
  currency: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  sessionId: string;
  gateway: GatewayType;
}

/**
 * What a verified webhook tells the platform. Deliberately carries no creator, sender or video:
 * those are read from the payment intent the platform recorded, never from the gateway payload.
 */
export interface ParsedPaymentEvent {
  intentId: string;
  gatewayTransactionRef: string;
  amountCents: number;
  status: "SUCCESS" | "FAILED" | "PENDING";
}

export interface PaymentGatewayAdapter {
  readonly gatewayName: GatewayType;
  createCheckoutSession(options: CreateCheckoutOptions): Promise<CheckoutSessionResult>;
  /** True only for a body signed by the gateway. Never lenient, whatever the environment. */
  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean;
  /** Throws {@link InvalidPaymentEventError} when the event cannot be settled. */
  parseWebhookEvent(payload: Record<string, unknown>): ParsedPaymentEvent;
}

export function requireString(payload: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  throw new InvalidPaymentEventError(`missing ${keys.join(" | ")}`);
}

export function dollarsToCents(value: unknown): number {
  const amount = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(amount) || amount < 0) {
    throw new InvalidPaymentEventError(`invalid amount ${String(value)}`);
  }
  return Math.round(amount * 100);
}
