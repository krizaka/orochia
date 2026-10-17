import { db, videos } from "@orochia/db";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireUserWithRole } from "@/lib/auth";
import { SEGMENT_MIN_SECONDS, videoBannerEnabled } from "@/lib/banner";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The signed-in creator's own videos a cover can use: published, public, free and at least 3 s long. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    if (!videoBannerEnabled()) return jsonError(404, "Video covers are not available yet");
    const rows = await db
      .select({ id: videos.id, title: videos.title, durationSeconds: videos.durationSeconds, thumbnailUrl: videos.thumbnailUrl })
      .from(videos)
      .where(and(eq(videos.creatorId, user.id), eq(videos.status, "READY"), eq(videos.visibility, "PUBLIC"), eq(videos.minTipAmountCents, 0), isNull(videos.removedAt), gte(videos.durationSeconds, SEGMENT_MIN_SECONDS)))
      .orderBy(desc(videos.createdAt))
      .limit(50);
    return NextResponse.json({ success: true, videos: rows });
  } catch (error) {
    return errorResponse(error, "me/banner-videos");
  }
}
