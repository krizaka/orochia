import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, stories, storyLikes } from "@orochia/db";
import { and, eq, sql } from "drizzle-orm";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await props.params;
    const storyId = params.id;

    // Check if already liked
    const [existing] = await db
      .select({ id: storyLikes.id })
      .from(storyLikes)
      .where(and(eq(storyLikes.storyId, storyId), eq(storyLikes.userId, user.id)))
      .limit(1);

    if (existing) {
      // Unlike
      await db.delete(storyLikes).where(eq(storyLikes.id, existing.id));
      await db
        .update(stories)
        .set({ likesCount: sql`GREATEST(0, ${stories.likesCount} - 1)` })
        .where(eq(stories.id, storyId));

      return NextResponse.json({ success: true, liked: false });
    } else {
      // Like
      await db.insert(storyLikes).values({ storyId, userId: user.id });
      await db
        .update(stories)
        .set({ likesCount: sql`${stories.likesCount} + 1` })
        .where(eq(stories.id, storyId));

      return NextResponse.json({ success: true, liked: true });
    }
  } catch (error) {
    return errorResponse(error, "stories/like");
  }
}
