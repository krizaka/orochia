import crypto from "crypto";
import { BunnyWebhookPayload, BunnyWebhookPayloadSchema } from "./types";

export interface WebhookVerificationOptions {
  rawBody: string;
  /** The request headers (any casing): X-BunnyStream-Signature, -Signature-Version, -Signature-Algorithm. */
  headers: { get(name: string): string | null };
  /** The library's Read-Only API key: Bunny signs every webhook with it. */
  signingKey: string;
}

/**
 * Verifies a Bunny Stream webhook (signature v1): lowercase hex HMAC-SHA256 of the raw body, keyed
 * with the library's Read-Only API key, compared in constant time. Anything else — no key
 * configured, another version or algorithm, a malformed signature — is refused.
 */
export function verifyBunnyWebhookSignature({ rawBody, headers, signingKey }: WebhookVerificationOptions): boolean {
  if (!signingKey) return false;
  if (headers.get("x-bunnystream-signature-version") !== "v1") return false;
  if (headers.get("x-bunnystream-signature-algorithm")?.toLowerCase() !== "hmac-sha256") return false;
  const signature = headers.get("x-bunnystream-signature") ?? "";
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  const expected = crypto.createHmac("sha256", Buffer.from(signingKey, "utf8")).update(rawBody, "utf8").digest();
  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), expected);
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
 * What a webhook status means for Orochia's video, or null when it changes nothing (captions,
 * generated titles). Only "finished" (3) makes a video READY: "one resolution finished" (4) keeps it
 * PROCESSING until every rendition is there.
 */
export function mapBunnyStatusToOrochia(statusCode: number): "PROCESSING" | "READY" | "FAILED" | null {
  switch (statusCode) {
    case 0:
    case 1:
    case 2:
    case 4:
    case 6:
    case 7:
      return "PROCESSING";
    case 3:
      return "READY";
    case 5:
    case 8:
      return "FAILED";
    default:
      return null;
  }
}
