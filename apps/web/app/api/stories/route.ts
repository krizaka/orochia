import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, requireUserWithRole } from "@/lib/auth";
import { STORY_AUDIENCES, createImageStory, storyRail } from "@/lib/stories";
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

/** The stories rail: one ring per creator with current stories you may see (yours first, then unseen), signed for you. */
export async function GET() {
  try {
    const viewer = await getCurrentUser();
    return NextResponse.json({ success: true, rings: await storyRail(viewer?.id ?? null) });
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
