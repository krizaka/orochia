import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, auctions, users, videos } from "@orochia/db";
import { desc, eq, sql } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const Status = z.enum(["OPEN", "AWAITING_DECISION", "SOLD", "DECLINED", "UNSOLD", "CANCELLED"]).optional().catch(undefined);

/** Every auction for operators (latest first, optionally by status): video, creator, price, bids, timing, outcome. */
export async function GET(req: NextRequest) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const status = Status.parse(req.nextUrl.searchParams.get("status") ?? undefined);
    const rows = await db
      .select({
        id: auctions.id,
        status: auctions.status,
        rights: auctions.rights,
        settlement: auctions.settlement,
        startingPriceCents: auctions.startingPriceCents,
        highestBidCents: auctions.highestBidCents,
        bidsCount: auctions.bidsCount,
        startsAt: auctions.startsAt,
        endsAt: auctions.endsAt,
        decisionDeadline: auctions.decisionDeadline,
        cancelReason: auctions.cancelReason,
        videoId: auctions.videoId,
        videoTitle: videos.title,
        creatorUsername: users.username,
        leaderUsername: sql<string | null>`(select u.username from users u where u.id = ${auctions.leaderId})`,
      })
      .from(auctions)
      .innerJoin(videos, eq(videos.id, auctions.videoId))
      .innerJoin(users, eq(users.id, auctions.creatorId))
      .where(status ? eq(auctions.status, status) : undefined)
      .orderBy(desc(auctions.createdAt))
      .limit(200);
    return NextResponse.json({ success: true, auctions: rows });
  } catch (error) {
    return errorResponse(error, "admin/auctions");
  }
}
