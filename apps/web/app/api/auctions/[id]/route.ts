import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { cancelAuction } from "@orochia/payments";
import { getCurrentUser, requireUserWithRole } from "@/lib/auth";
import { announceClose, auctionHttpError, auctionIdOr404, auctionView } from "@/lib/auctions";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** An auction as the viewer sees it: price, minimum next bid, timing, recent bids (aliases), and their own standing. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const id = auctionIdOr404((await props.params).id);
    const user = await getCurrentUser();
    const auction = await auctionView(id, user?.id ?? null);
    if (!auction) return jsonError(404, "Auction not found");
    return NextResponse.json({ success: true, auction });
  } catch (error) {
    return errorResponse(error, "auctions/get");
  }
}

const Cancel = z.object({ reason: z.string().trim().max(300).optional() }).catch({});

/** The creator cancels their auction while nobody has bid; the video gets its previous visibility back. */
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR"]);
    const id = auctionIdOr404((await props.params).id);
    const { reason } = Cancel.parse(await req.json().catch(() => ({})));
    const result = await cancelAuction({ auctionId: id, creatorId: user.id, reason: reason || "Cancelled by its creator" });
    after(() => announceClose({ kind: "CANCELLED", ...result }));
    return NextResponse.json({ success: true });
  } catch (error) {
    const known = auctionHttpError(error);
    if (known) return jsonError(known.status, known.message, known.extra);
    return errorResponse(error, "auctions/cancel");
  }
}
