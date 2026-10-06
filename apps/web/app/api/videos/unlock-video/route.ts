import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, videos } from "@orochia/db";
import { eq } from "drizzle-orm";
import {
  GatewayTypeSchema,
  attachGatewaySession,
  configuredGateways,
  createPaymentIntent,
  getPaymentGateway,
  settlePaymentIntent,
} from "@orochia/payments";
import { requireUserWithRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/redis";
import { appUrl, isDemoMode } from "@/lib/env";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const UnlockVideoRequestSchema = z.object({
  videoId: z.string().uuid(),
  amountCents: z.number().int().positive().max(100_000_00),
  gateway: GatewayTypeSchema,
});

/**
 * Starts the purchase of a video unlock. The client is never trusted to say it paid: this records
 * a payment intent and returns the gateway's checkout URL; the access grant is created only when
 * the gateway's signed webhook confirms the payment (/api/webhooks/payments/[gateway]).
 *
 * Demo mode (never in production, no gateway configured) settles the intent at once, so the
 * showcase works without merchant accounts.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const limit = await checkRateLimit(`checkout:${user.id}`, 20, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many payment attempts. Try again later.");

    const { videoId, amountCents, gateway } = UnlockVideoRequestSchema.parse(await req.json());

    const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
    if (!video || video.status !== "READY") return jsonError(404, "Video not found");
    if (video.creatorId === user.id) return jsonError(400, "You already own this video");
    if (amountCents < video.minTipAmountCents) {
      return jsonError(400, `Minimum to unlock is $${(video.minTipAmountCents / 100).toFixed(2)}`);
    }

    const intent = await createPaymentIntent({
      gateway,
      senderId: user.id,
      creatorId: video.creatorId,
      videoId: video.id,
      amountCents,
    });

    const configured = configuredGateways();
    if (configured.length === 0 && isDemoMode()) {
      const outcome = await settlePaymentIntent(gateway, {
        intentId: intent.id,
        gatewayTransactionRef: `demo_${intent.id}`,
        amountCents,
        status: "SUCCESS",
      });
      return NextResponse.json({ success: true, settled: outcome.kind === "SETTLED", demo: true });
    }
    if (!configured.includes(gateway)) return jsonError(400, "This payment method is not available");

    const session = await getPaymentGateway(gateway).createCheckoutSession({
      intentId: intent.id,
      amountCents,
      currency: "USD",
      description: `Unlock: ${video.title}`.slice(0, 120),
      returnUrl: `${appUrl()}/watch/${video.id}?payment=success`,
      cancelUrl: `${appUrl()}/watch/${video.id}?payment=cancelled`,
    });
    await attachGatewaySession(intent.id, session.sessionId);

    return NextResponse.json({ success: true, checkoutUrl: session.checkoutUrl });
  } catch (error) {
    return errorResponse(error, "videos/unlock-video");
  }
}
