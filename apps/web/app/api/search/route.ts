import { NextResponse } from "next/server";
import { db, users, profiles, videos } from "@orochia/db";
import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { searchVideos, popularTags } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim().slice(0, 80);

    if (!q) {
      // If query is empty, return top recommendations & popular tags
      const [topVideos, topTags] = await Promise.all([
        searchVideos({ limit: 6 }),
        popularTags(8),
      ]);
      return NextResponse.json({
        creators: [],
        videos: topVideos,
        tags: topTags,
      });
    }

    const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

    // 1. Search creators
    const creators = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
        avatarUrl: profiles.avatarUrl,
        bio: profiles.bio,
        isVerified: users.isVerified,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(
        and(
          eq(users.role, "CREATOR"),
          isNull(users.suspendedAt),
          or(ilike(users.username, like), ilike(profiles.displayName, like), ilike(profiles.bio, like))
        )
      )
      .limit(6);

    // 2. Search videos
    const matchingVideos = await searchVideos({ q, limit: 10 });

    // 3. Search tags
    const allTags = await popularTags(20);
    const matchingTags = allTags.filter((t) => t.tag.toLowerCase().includes(q.toLowerCase()));

    return NextResponse.json({
      creators,
      videos: matchingVideos,
      tags: matchingTags,
    });
  } catch (error) {
    console.error("[search] query error:", error);
    return NextResponse.json({ creators: [], videos: [], tags: [] }, { status: 500 });
  }
}
