import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { recordWatch, WatchEventInput } from "@/lib/feed-events";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * A slide of the vertical feed left the screen: `{ videoId, visit, watchedPct, dwellMs }`. A signed-in viewer's look becomes a
 * skip or a view for the recommender (lib/feed-events.ts); a visitor has no account to learn from, so nothing is kept (204).
 */
export async function POST(req: NextRequest) {
  try {
    const viewer = await getCurrentUser();
    if (!viewer) return new NextResponse(null, { status: 204 });
    // @fixed: a person flicking through a feed sends one event per slide; this only stops a script
    await enforceRateLimit(`feed-events:${viewer.id}`, 1200, 60 * 60, "Too many requests. Try again later.");
    const input = WatchEventInput.parse(await req.json());
    const kind = await recordWatch(viewer.id, input, new Date());
    return NextResponse.json({ success: true, recorded: kind !== null });
  } catch (error) {
    return errorResponse(error, "feed/events");
  }
}
