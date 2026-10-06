import { z } from "zod";

export const GatewayTypeSchema = z.enum(["CCBILL", "SEGPAY", "CRYPTO", "STRIPE"]);
export type GatewayType = z.infer<typeof GatewayTypeSchema>;

export interface CreateCheckoutOptions {
  amountCents: number;
  currency: string;
  senderId?: string;
  creatorId: string;
  videoId?: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  checkoutUrl: string;
  sessionId: string;
  gateway: GatewayType;
  metadata?: Record<string, unknown>;
}

export interface ParsedPaymentEvent {
  gatewayTransactionRef: string;
  amountCents: number;
  creatorId: string;
  senderId?: string;
  videoId?: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  rawEvent: Record<string, unknown>;
}

export interface PaymentGatewayAdapter {
  readonly gatewayName: GatewayType;
  createCheckoutSession(options: CreateCheckoutOptions): Promise<CheckoutSessionResult>;
  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean;
  parseWebhookEvent(payload: Record<string, unknown>): ParsedPaymentEvent;
}
