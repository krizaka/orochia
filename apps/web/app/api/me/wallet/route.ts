import { NextResponse } from "next/server";
import { CREDIT_PACKS, configuredGateways, getWalletBalanceCents, heldInBidsCents, heldInChallengesCents, testTopupsEnabled, walletHistory } from "@orochia/payments";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Your Orochia credits: balance (and what is held behind your leading bids and challenge pledges), the packs you can buy, how you can pay for them, and your history. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const [balanceCents, inBids, inChallenges, history] = await Promise.all([getWalletBalanceCents(user.id), heldInBidsCents(user.id), heldInChallengesCents(user.id), walletHistory(user.id)]);
    const heldCents = inBids + inChallenges;
    return NextResponse.json({
      success: true,
      balanceCents,
      heldCents,
      packs: CREDIT_PACKS,
      gateways: configuredGateways(),
      testTopups: testTopupsEnabled(),
      history: history.map((h) => ({ id: h.id, type: h.entryType, amountCents: h.amountCents, note: h.note, createdAt: h.createdAt })),
    });
  } catch (error) {
    return errorResponse(error, "me/wallet");
  }
}
