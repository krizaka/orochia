import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, stories, storyViews } from "@orochia/db";
import { and, eq, sql } from "drizzle-orm";
import { errorResponse } from "@/lib/http";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const params = await props.params;
    const storyId = params.id;

    // Optional IP hash for deduplication
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);

    // Record view in storyViews
    await db.insert(storyViews).values({
      storyId,
      viewerId: user?.id ?? null,
      ipHash,
    });

    // Increment story views count
    await db
      .update(stories)
      .set({ viewsCount: sql`${stories.viewsCount} + 1` })
      .where(eq(stories.id, storyId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "stories/view");
  }
}
