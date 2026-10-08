import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { placeBid } from "@orochia/payments";
import { requireUserWithRole } from "@/lib/auth";
import { announceBid, auctionHttpError, auctionIdOr404, notifyBid } from "@/lib/auctions";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Bid = z.object({ amountCents: z.number().int().positive() });

/**
 * Places a bid in Orochia credits; they are held while the bid leads and released when it is outbid. Every viewer of
 * the auction receives the bid live; a bid in the last two minutes pushes the end back.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = auctionIdOr404((await props.params).id);
    if (!(await checkRateLimit(`bid:${user.id}`, 30, 60)).success) return jsonError(429, "Too many bids. Wait a moment.");
    const { amountCents } = Bid.parse(await req.json());
    const outcome = await placeBid({ auctionId: id, bidderId: user.id, amountCents });
    // The live feed goes out before the response, so the bidder's own screen and everyone else's agree.
    const alias = await announceBid({
      auction: outcome.auction,
      bidId: outcome.bid.id,
      bidderId: user.id,
      amountCents,
      createdAt: outcome.bid.createdAt,
      outbidUserId: outcome.outbidUserId,
      extended: outcome.extended,
    });
    after(() => notifyBid({ auction: outcome.auction, amountCents, outbidUserId: outcome.outbidUserId }));
    return NextResponse.json({ success: true, alias, balanceCents: outcome.balanceCents, endsAt: outcome.auction.endsAt, extended: outcome.extended });
  } catch (error) {
    const known = auctionHttpError(error);
    if (known) return jsonError(known.status, known.message, known.extra);
    return errorResponse(error, "auctions/bid");
  }
}
