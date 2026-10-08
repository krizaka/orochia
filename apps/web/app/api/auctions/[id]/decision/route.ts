import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { decideAuction } from "@orochia/payments";
import { requireUserWithRole } from "@/lib/auth";
import { announceClose, auctionHttpError, auctionIdOr404 } from "@/lib/auctions";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Decision = z.object({ accept: z.boolean() });

/** The creator accepts the best bid (the video is sold to its bidder) or declines it (the credits go back). */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR"]);
    const id = auctionIdOr404((await props.params).id);
    const { accept } = Decision.parse(await req.json());
    const outcome = await decideAuction({ auctionId: id, creatorId: user.id, accept });
    after(() => announceClose(outcome));
    return NextResponse.json({ success: true, status: outcome.kind });
  } catch (error) {
    const known = auctionHttpError(error);
    if (known) return jsonError(known.status, known.message, known.extra);
    return errorResponse(error, "auctions/decision");
  }
}
