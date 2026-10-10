import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { db, users } from "@orochia/db";
import { eq, sql } from "drizzle-orm";
import { getCurrentUser, requireUserWithRole } from "@/lib/auth";
import { STORY_AUDIENCES, createImageStory, reconcileStoryVideos, storyRail } from "@/lib/stories";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const ImageStory = z.object({
  imageRef: z.string().min(1).max(200),
  caption: z.string().trim().max(280).nullish(),
  audience: z.enum(STORY_AUDIENCES).default("PUBLIC"),
  audienceListId: z.string().uuid().nullish(),
  contentRatingId: z.string().max(30).nullish(),
  isBlurred: z.boolean().optional().default(false),
});

/**
 * The stories rail: one ring per creator with current stories you may see (yours first, then unseen), signed for you —
 * `?creator=<username>` keeps that creator's ring only (a profile's story ring); with `?pending=1`, your own video stories too while they are processing (`state`). Video stories whose Bunny webhook never came are caught
 * up here: yours before answering (so a finished story shows at once), everyone else's after the response.
 */
export async function GET(req: NextRequest) {
  try {
    const viewer = await getCurrentUser();
    if (viewer) await reconcileStoryVideos({ creatorId: viewer.id, limit: 5 }).catch(() => undefined);
    after(() => reconcileStoryVideos({ limit: 10 }).catch(() => undefined));
    const username = req.nextUrl.searchParams.get("creator")?.trim().toLowerCase().slice(0, 64);
    let creatorId: string | undefined;
    if (username) {
      const [creator] = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.username})`, username)).limit(1);
      if (!creator) return NextResponse.json({ success: true, rings: [] });
      creatorId = creator.id;
    }
    const includeOwnPending = req.nextUrl.searchParams.get("pending") === "1";
    return NextResponse.json({ success: true, rings: await storyRail(viewer?.id ?? null, { includeOwnPending, creatorId }) });
  } catch (error) {
    return errorResponse(error, "stories/rail");
  }
}

/** Publishes an image story (24 h) from an image stored by /api/uploads (category "stories"); verified creators only. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const limit = await checkRateLimit(`story:${user.id}`, 30, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many stories. Try again later.");
    const story = await createImageStory(user.id, ImageStory.parse(await req.json()));
    return NextResponse.json({ success: true, story }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "stories/create-image");
  }
}
