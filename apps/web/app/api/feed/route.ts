import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { FEED_PAGE_MAX, FEED_PAGE_SIZE, FEED_SORTS, FeedSort } from "@/lib/feed-cursor";
import { errorResponse, jsonError } from "@/lib/http";
import { featuredCreator, feedPage, popularTags, searchVideos } from "@/lib/queries";

export const dynamic = "force-dynamic";

const Page = z.object({
  sort: z.enum(FEED_SORTS),
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(FEED_PAGE_MAX).default(FEED_PAGE_SIZE),
});

const Search = z.object({
  q: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

/**
 * The feeds, a page at a time. `?sort=latest|trending|following&cursor=…` is the home feed's keyset pagination
 * (`{ videos, nextCursor }`, nextCursor null on the last page; `following` needs a session). Without `sort` it is the
 * explore search (`?q=`, `?tag=`, `offset`), with the featured creator and popular tags.
 */
export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const viewer = await getCurrentUser();
    if ("sort" in params) {
      const query = Page.parse(params);
      if (query.sort === FeedSort.Following && !viewer) return jsonError(401, "Sign in to see the creators you follow");
      const page = await feedPage({ ...query, viewerId: viewer?.id }, viewer?.isAgeVerified === true);
      return NextResponse.json({ success: true, ...page }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const query = Search.parse(params);
    const [videos, featured, tags] = await Promise.all([searchVideos(query, viewer?.isAgeVerified === true), featuredCreator(), popularTags()]);
    return NextResponse.json({ success: true, videos, featured, tags });
  } catch (error) {
    return errorResponse(error, "feed");
  }
}
