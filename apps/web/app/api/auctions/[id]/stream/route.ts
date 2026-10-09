import { NextRequest } from "next/server";
import { auctionIdOr404, auctionTopic } from "@/lib/auctions";
import { sseResponse } from "@/lib/realtime";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Server-Sent Events of an auction: each bid (amount, alias, new end) and every change of state. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const id = auctionIdOr404((await props.params).id);
    return sseResponse([auctionTopic(id)], { status: "connected", serverNow: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error, "auctions/stream");
  }
}
