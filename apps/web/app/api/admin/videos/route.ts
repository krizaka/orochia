import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, users, videos, complianceReports } from "@orochia/db";
import { and, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const Query = z.object({
  state: z.enum(["listed", "removed", "all"]).default("all"),
  q: z.string().trim().max(100).optional(),
});

/** The catalogue for moderation: every video with its creator, state and open reports; `?state=removed` lists takedowns. */
export async function GET(req: NextRequest) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const { state, q } = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
    const filters: (SQL | undefined)[] = [];
    if (state === "listed") filters.push(isNull(videos.removedAt));
    if (state === "removed") filters.push(isNotNull(videos.removedAt));
    if (q) filters.push(or(ilike(videos.title, `%${q}%`), ilike(users.username, `%${q}%`)));
    const rows = await db
      .select({
        id: videos.id,
        title: videos.title,
        status: videos.status,
        visibility: videos.visibility,
        creatorUsername: users.username,
        viewsCount: videos.viewsCount,
        tipsCount: videos.tipsCount,
        createdAt: videos.createdAt,
        removedAt: videos.removedAt,
        removalReason: videos.removalReason,
        openReports: sql<number>`(select count(*)::int from ${complianceReports} r where r.video_id = ${videos.id} and r.status <> 'RESOLVED')`,
      })
      .from(videos)
      .innerJoin(users, eq(users.id, videos.creatorId))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(videos.createdAt))
      .limit(500);
    return NextResponse.json({ success: true, videos: rows });
  } catch (error) {
    return errorResponse(error, "admin/videos");
  }
}
