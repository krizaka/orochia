import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { featuredCreator, popularTags, searchVideos } from "@/lib/queries";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const Query = z.object({
  q: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

/** The public feed and the explore search (`?q=`, `?tag=`, paginated); with the featured creator and popular tags. */
export async function GET(req: NextRequest) {
  try {
    const query = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
    const [videos, featured, tags] = await Promise.all([searchVideos(query), featuredCreator(), popularTags()]);
    return NextResponse.json({ success: true, videos, featured, tags });
  } catch (error) {
    return errorResponse(error, "feed");
  }
}
