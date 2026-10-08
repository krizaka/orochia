import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { auctionIdForVideo, auctionView } from "@/lib/auctions";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The auction a video is in (open, awaiting its decision or sold), as the viewer sees it; null when there is none. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Video not found");
    const auctionId = await auctionIdForVideo(id.data);
    const user = auctionId ? await getCurrentUser() : null;
    const auction = auctionId ? await auctionView(auctionId, user?.id ?? null) : null;
    return NextResponse.json({ success: true, auction });
  } catch (error) {
    return errorResponse(error, "videos/auction");
  }
}
