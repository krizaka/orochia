import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CREDIT_PACKS, GatewayTypeSchema, configuredGateways, createTopup, getPaymentGateway, grantTestTopup, testTopupsEnabled } from "@orochia/payments";
import { requireUserWithRole } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const PACK_IDS = CREDIT_PACKS.map((p) => p.id) as [string, ...string[]];
const Topup = z.object({ packId: z.enum(PACK_IDS), gateway: z.union([GatewayTypeSchema, z.literal("TEST")]) });

/**
 * Buys credits: returns the gateway's hosted checkout (card, Apple Pay, Google Pay — card details never reach Orochia);
 * the gateway's signed webhook adds the credits. A test top-up (dev and test only) adds them at once.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    if (!(await checkRateLimit(`topup:${user.id}`, 10, 60 * 60)).success) return jsonError(429, "Too many attempts. Try again later.");
    const { packId, gateway } = Topup.parse(await req.json());
    const pack = CREDIT_PACKS.find((p) => p.id === packId)!;

    if (gateway === "TEST") {
      if (!testTopupsEnabled()) return jsonError(400, "This payment method is not available");
      await grantTestTopup(user.id, pack.id);
      return NextResponse.json({ success: true, settled: true });
    }
    if (gateway === "CREDITS" || !configuredGateways().includes(gateway)) return jsonError(400, "This payment method is not available");

    const topup = await createTopup(user.id, pack.id, gateway);
    const session = await getPaymentGateway(gateway).createCheckoutSession({
      intentId: topup.id,
      amountCents: pack.priceCents,
      currency: "USD",
      description: `Orochia credits — ${(pack.creditsCents / 100).toFixed(2)}`,
      returnUrl: `${appUrl()}/wallet?topup=success`,
      cancelUrl: `${appUrl()}/wallet?topup=cancelled`,
    });
    return NextResponse.json({ success: true, checkoutUrl: session.checkoutUrl }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "me/wallet/topups");
  }
}
