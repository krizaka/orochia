import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import {
  GatewayTypeSchema,
  attachGatewaySession,
  chargeCredits,
  configuredGateways,
  createPaymentIntent,
  getPaymentGateway,
  refundCredits,
  settlePaymentIntent,
} from "@orochia/payments";
import { db, profiles } from "@orochia/db";
import { eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { appUrl, isDemoMode } from "@/lib/env";
import { errorResponse, jsonError } from "@/lib/http";
import { notifySettlement } from "@/lib/notifications";
import { storyForViewerAction } from "@/lib/stories";

export const dynamic = "force-dynamic";

const StoryTip = z.object({
  amountCents: z.number().int().positive().max(100_000_00),
  gateway: GatewayTypeSchema,
});

/**
 * Tips a creator from one of their stories. The same path as every payment: a payment intent (who, whom, which
 * story, how much) → the wallet settles at once (402 with the balance when it does not cover the amount), or the
 * gateway's checkout and its signed webhook. The creator's tip minimum applies; the story counts its tips.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Story not found");
    const limit = await checkRateLimit(`checkout:${user.id}`, 20, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many payment attempts. Try again later.");
    const { amountCents, gateway } = StoryTip.parse(await req.json());

    const story = await storyForViewerAction(id.data, user.id);
    const [profile] = await db.select({ minTipCents: profiles.minTipAmountCents }).from(profiles).where(eq(profiles.userId, story.creatorId)).limit(1);
    const minimum = profile?.minTipCents ?? 500;
    if (amountCents < minimum) return jsonError(400, `Minimum tip is $${(minimum / 100).toFixed(2)}`);

    const intent = await createPaymentIntent({ gateway, senderId: user.id, creatorId: story.creatorId, storyId: story.id, amountCents });

    if (gateway === "CREDITS") {
      const charge = await chargeCredits({ intentId: intent.id, buyerId: user.id, amountCents });
      if (!charge.approved) return jsonError(402, "Not enough credits", { balanceCents: charge.balanceCents ?? 0, topUpUrl: "/wallet" });
      const outcome = await settlePaymentIntent("CREDITS", { intentId: intent.id, gatewayTransactionRef: charge.reference, amountCents, status: "SUCCESS" });
      // Credits are only kept for a settled payment.
      if (outcome.kind !== "SETTLED" && outcome.kind !== "ALREADY_SETTLED") await refundCredits({ intentId: intent.id, buyerId: user.id, amountCents });
      if (outcome.kind === "SETTLED") after(() => notifySettlement(intent.id, false));
      return NextResponse.json({ success: true, settled: outcome.kind === "SETTLED" });
    }

    const configured = configuredGateways();
    if (configured.length === 0 && isDemoMode()) {
      const outcome = await settlePaymentIntent(gateway, { intentId: intent.id, gatewayTransactionRef: `demo_${intent.id}`, amountCents, status: "SUCCESS" });
      if (outcome.kind === "SETTLED") after(() => notifySettlement(intent.id, false));
      return NextResponse.json({ success: true, settled: outcome.kind === "SETTLED", demo: true });
    }
    if (!configured.includes(gateway)) return jsonError(400, "This payment method is not available");

    const session = await getPaymentGateway(gateway).createCheckoutSession({
      intentId: intent.id,
      amountCents,
      currency: "USD",
      description: "Story tip",
      returnUrl: `${appUrl()}/?story=${story.id}&payment=success`,
      cancelUrl: `${appUrl()}/?story=${story.id}&payment=cancelled`,
    });
    await attachGatewaySession(intent.id, session.sessionId);
    return NextResponse.json({ success: true, checkoutUrl: session.checkoutUrl });
  } catch (error) {
    return errorResponse(error, "stories/tip");
  }
}
