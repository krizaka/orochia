import crypto from "crypto";
import { BunnyWebhookPayload, BunnyWebhookPayloadSchema } from "./types";

export interface WebhookVerificationOptions {
  rawBody: string;
  signatureHeader?: string | null;
  webhookSecret: string;
}

/**
 * Validates the authenticity of webhook calls dispatched by Bunny.net Stream.
 */
export function verifyBunnyWebhookSignature({
  rawBody,
  signatureHeader,
  webhookSecret,
}: WebhookVerificationOptions): boolean {
  if (!webhookSecret) {
    // If no secret configured in staging, log warning but do not blindly accept in production
    return process.env.NODE_ENV !== "production";
  }

  if (!signatureHeader) {
    return false;
  }

  try {
    const computedHash = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    const signatureBuffer = Buffer.from(signatureHeader, "hex");
    const computedBuffer = Buffer.from(computedHash, "hex");

    if (signatureBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, computedBuffer);
  } catch (error) {
    console.error("Webhook signature verification error:", error);
    return false;
  }
}

/**
 * Parses and validates raw webhook JSON payload into a typed event.
 */
export function parseBunnyWebhookPayload(rawPayload: unknown): BunnyWebhookPayload {
  const result = BunnyWebhookPayloadSchema.safeParse(rawPayload);
  if (!result.success) {
    throw new Error(`Invalid Bunny webhook payload schema: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Translates Bunny status code to Orochia video status enum.
 */
export function mapBunnyStatusToOrochia(statusCode: number): "PENDING_UPLOAD" | "PROCESSING" | "READY" | "FAILED" {
  switch (statusCode) {
    case 0:
    case 1:
      return "PENDING_UPLOAD";
    case 2:
    case 3:
      return "PROCESSING";
    case 4:
      return "READY";
    case 5:
    default:
      return "FAILED";
  }
}
