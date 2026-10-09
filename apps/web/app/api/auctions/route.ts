import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createAuction } from "@orochia/payments";
import { getCurrentUser, requireUserWithRole } from "@/lib/auth";
import { AUCTION_TABS, auctionHttpError, listAuctions, notifyAuctionAnnounced } from "@/lib/auctions";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Create = z.object({
  videoId: z.string().uuid(),
  startingPriceCents: z.number().int().positive(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  rights: z.enum(["WATCH", "DOWNLOAD"]),
  settlement: z.enum(["CREATOR_DECIDES", "HIGHEST_BID"]),
});

/** Lists auctions by tab: open, upcoming, ended (sold), bidding (yours) or selling (your own). */
export async function GET(req: NextRequest) {
  try {
    const tab = z.enum(AUCTION_TABS).catch("open").parse(req.nextUrl.searchParams.get("tab"));
    const user = tab === "bidding" || tab === "selling" ? await getCurrentUser() : null;
    if ((tab === "bidding" || tab === "selling") && !user) return jsonError(401, "Sign in to see your auctions");
    return NextResponse.json({ success: true, tab, items: await listAuctions(tab, user?.id ?? null) });
  } catch (error) {
    return errorResponse(error, "auctions/list");
  }
}

/** Puts one of the creator's ready videos up for auction (start, end, starting price, rights, how it ends). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["CREATOR"]);
    if (!(await checkRateLimit(`auction-create:${user.id}`, 20, 60 * 60)).success) return jsonError(429, "Too many auctions created. Try again later.");
    const input = Create.parse(await req.json());
    const auction = await createAuction({ ...input, creatorId: user.id });
    after(() => notifyAuctionAnnounced(auction));
    return NextResponse.json({ success: true, auctionId: auction.id }, { status: 201 });
  } catch (error) {
    const known = auctionHttpError(error);
    if (known) return jsonError(known.status, known.message, known.extra);
    return errorResponse(error, "auctions/create");
  }
}
