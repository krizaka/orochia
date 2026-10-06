import { db, paymentIntents } from "@orochia/db";
import { eq } from "drizzle-orm";
import { creditTip, TipResult } from "./ledger";
import { GatewayType, ParsedPaymentEvent } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateIntentOptions {
  gateway: GatewayType;
  senderId: string;
  creatorId: string;
  videoId?: string | null;
  amountCents: number;
  currency?: string;
}

/** Records what will be settled, before the buyer is sent to the gateway. */
export async function createPaymentIntent(options: CreateIntentOptions) {
  const [intent] = await db
    .insert(paymentIntents)
    .values({
      gateway: options.gateway,
      senderId: options.senderId,
      creatorId: options.creatorId,
      videoId: options.videoId ?? null,
      amountCents: options.amountCents,
      currency: options.currency ?? "USD",
    })
    .returning();
  return intent;
}

export async function attachGatewaySession(intentId: string, gatewaySessionId: string) {
  await db
    .update(paymentIntents)
    .set({ gatewaySessionId, updatedAt: new Date() })
    .where(eq(paymentIntents.id, intentId));
}

export type SettlementOutcome =
  | { kind: "SETTLED"; tip: TipResult }
  | { kind: "ALREADY_SETTLED" }
  | { kind: "FAILED" }
  | { kind: "PENDING" }
  | { kind: "UNKNOWN_INTENT" }
  | { kind: "GATEWAY_MISMATCH" }
  | { kind: "UNDERPAID"; expectedCents: number; paidCents: number };

/**
 * Applies a verified gateway event to its payment intent, exactly once.
 *
 * The intent row is locked for the whole settlement, so concurrent deliveries of the same webhook
 * serialise and the second one sees SUCCEEDED. Who pays, who is paid and for which video come from
 * the intent; the event only says whether, and how much, was paid.
 */
export async function settlePaymentIntent(
  gateway: GatewayType,
  event: ParsedPaymentEvent,
): Promise<SettlementOutcome> {
  if (!UUID.test(event.intentId)) return { kind: "UNKNOWN_INTENT" };

  return db.transaction(async (tx) => {
    const [intent] = await tx
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.id, event.intentId))
      .for("update")
      .limit(1);

    if (!intent) return { kind: "UNKNOWN_INTENT" } as const;
    if (intent.gateway !== gateway) return { kind: "GATEWAY_MISMATCH" } as const;
    if (intent.status === "SUCCEEDED") return { kind: "ALREADY_SETTLED" } as const;
    if (event.status === "PENDING") return { kind: "PENDING" } as const;

    if (event.status === "FAILED") {
      await tx
        .update(paymentIntents)
        .set({ status: "FAILED", gatewayTransactionRef: event.gatewayTransactionRef, updatedAt: new Date() })
        .where(eq(paymentIntents.id, intent.id));
      return { kind: "FAILED" } as const;
    }

    if (event.amountCents < intent.amountCents) {
      return { kind: "UNDERPAID", expectedCents: intent.amountCents, paidCents: event.amountCents } as const;
    }

    const tip = await creditTip(tx, {
      senderId: intent.senderId,
      creatorId: intent.creatorId,
      videoId: intent.videoId,
      grossAmountCents: intent.amountCents,
      gateway,
      gatewayTransactionRef: event.gatewayTransactionRef,
      note: intent.videoId ? "Video unlock" : "Creator tip",
    });

    await tx
      .update(paymentIntents)
      .set({
        status: "SUCCEEDED",
        gatewayTransactionRef: event.gatewayTransactionRef,
        ledgerId: tip.ledgerId,
        updatedAt: new Date(),
      })
      .where(eq(paymentIntents.id, intent.id));

    return { kind: "SETTLED", tip } as const;
  });
}
