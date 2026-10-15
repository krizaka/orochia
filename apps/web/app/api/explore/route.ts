import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { exploreSections, exploreTag } from "@/lib/explore";
import { exploreResultsByMeaning } from "@/lib/explore-semantic";
import { errorResponse } from "@/lib/http";
import { limitAction } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Query = z.object({
  q: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(64).optional(),
  view: z.enum(["all"]).optional(),
  page: z.coerce.number().int().min(1).max(400).default(1),
});

/**
 * Explore: without a search, the discovery sections (trending this week, new, stories, creators to follow, open
 * auctions, open challenges, tags); with `q` and/or `tag` (or `view=all`), videos (paged), creators and stories.
 * Public content only — followers, contacts, close friends and paid content never appear (lib/discoverable.ts).
 */
export async function GET(req: NextRequest) {
  try {
    const query = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
    const viewer = await getCurrentUser();
    await limitAction("explore", req, viewer?.id, { perIp: [120, 60], perUser: [120, 60] }, "Too many requests. Slow down.");
    const tag = exploreTag(query.tag);
    if (query.q || tag || query.view === "all") {
      // `meaning` (why the Explorer did or did not add videos) is for the operator's view, not for visitors.
      const { meaning: _meaning, ...results } = await exploreResultsByMeaning(viewer, { q: query.q, tag, page: query.page });
      return NextResponse.json({ success: true, tag, ...results });
    }
    return NextResponse.json({ success: true, sections: await exploreSections(viewer) });
  } catch (error) {
    return errorResponse(error, "explore");
  }
}
