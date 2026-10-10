import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { discoverableTags, exploreResults, newVideos } from "@/lib/explore";
import { errorResponse } from "@/lib/http";
import { normalizeTag } from "@/lib/tags";

export const dynamic = "force-dynamic";

const Query = z.object({ q: z.string().trim().max(80).default("") });

/**
 * The search palette: creators, videos, stories and tags matching what is typed (full-text, accents ignored, word
 * prefixes); with nothing typed, the newest videos and the popular tags. Public content only (lib/discoverable.ts).
 */
export async function GET(req: NextRequest) {
  try {
    const { q } = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
    const viewer = await getCurrentUser();
    if (!q) {
      const [videos, tags] = await Promise.all([newVideos(viewer, 6), discoverableTags(8)]);
      return NextResponse.json({ success: true, creators: [], videos, stories: [], tags });
    }
    const [results, allTags] = await Promise.all([exploreResults(viewer, { q }), discoverableTags(60)]);
    const wanted = normalizeTag(q);
    const tags = allTags.filter((entry) => entry.tag.includes(q.toLowerCase().replace(/^#/, "")) || (wanted !== null && entry.tag.includes(wanted)));
    return NextResponse.json({
      success: true,
      creators: results.creators.slice(0, 6),
      videos: results.videos.slice(0, 10),
      stories: results.stories.slice(0, 6),
      tags: tags.slice(0, 8),
    });
  } catch (error) {
    return errorResponse(error, "search");
  }
}
