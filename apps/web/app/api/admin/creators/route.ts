import { NextRequest, NextResponse } from "next/server";
import { db, users, profiles, videos } from "@orochia/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Creator accounts with their verification state; `?verified=false` lists the review queue. */
export async function GET(req: NextRequest) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const verified = new URL(req.url).searchParams.get("verified");
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        isVerified: users.isVerified,
        createdAt: users.createdAt,
        displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
        videosCount: sql<string>`(select count(*) from ${videos} where ${videos.creatorId} = ${users.id})`,
        totalTipsEarnedCents: profiles.totalTipsEarnedCents,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(
        verified === "true" || verified === "false"
          ? and(eq(users.role, "CREATOR"), eq(users.isVerified, verified === "true"))
          : eq(users.role, "CREATOR"),
      )
      .orderBy(desc(users.createdAt))
      .limit(500);
    return NextResponse.json({
      success: true,
      creators: rows.map((r) => ({ ...r, videosCount: Number(r.videosCount), totalTipsEarnedCents: r.totalTipsEarnedCents ?? 0 })),
    });
  } catch (error) {
    return errorResponse(error, "admin/creators");
  }
}
