import { NextRequest, NextResponse } from "next/server";
import {
  GatewayConfigurationError,
  GatewayTypeSchema,
  InvalidPaymentEventError,
  getPaymentGateway,
  settlePaymentIntent,
} from "@orochia/payments";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Gateway payment notifications. Order of operations, and why:
 *   1. the signature is verified over the raw body — an unsigned or forged call is refused (401);
 *   2. the event is parsed — it names our payment intent, never who to credit;
 *   3. the intent is settled exactly once (row lock + ledger uniqueness).
 * A replayed webhook therefore answers 200 without crediting anyone twice.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ gateway: string }> }) {
  const params = await props.params;
  try {
    const gateway = GatewayTypeSchema.safeParse(params.gateway.toUpperCase());
    if (!gateway.success) return jsonError(404, "Unknown gateway");

    const adapter = getPaymentGateway(gateway.data);
    const rawBody = await req.text();
    const headers = Object.fromEntries(req.headers.entries());
    if (!adapter.verifyWebhookSignature(rawBody, headers)) {
      return jsonError(401, "Invalid signature");
    }

    const contentType = req.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/x-www-form-urlencoded")
      ? Object.fromEntries(new URLSearchParams(rawBody).entries())
      : (JSON.parse(rawBody) as Record<string, unknown>);

    const event = adapter.parseWebhookEvent(payload);
    const outcome = await settlePaymentIntent(gateway.data, event);
    if (outcome.kind === "UNDERPAID" || outcome.kind === "GATEWAY_MISMATCH") {
      console.error(`[webhooks/payments] ${gateway.data} intent ${event.intentId}: ${outcome.kind}`);
    }
    return NextResponse.json({ received: true, outcome: outcome.kind });
  } catch (error) {
    if (error instanceof GatewayConfigurationError) {
      return jsonError(404, "Gateway not enabled on this deployment");
    }
    if (error instanceof InvalidPaymentEventError) {
      // Signed but not settleable (e.g. an event type we do not use): acknowledge, do nothing.
      return NextResponse.json({ received: true, outcome: "IGNORED" });
    }
    return errorResponse(error, "webhooks/payments");
  }
}
