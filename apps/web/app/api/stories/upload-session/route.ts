import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UPLOAD_LIMITS } from "@orochia/media/limits";
import { requireUserWithRole } from "@/lib/auth";
import { STORY_AUDIENCES, openVideoStoryUpload } from "@/lib/stories";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const VideoStory = z.object({
  caption: z.string().trim().max(280).nullish(),
  audience: z.enum(STORY_AUDIENCES).default("PUBLIC"),
  audienceListId: z.string().uuid().nullish(),
  /** Size of the clip about to be sent, refused above the story limit. */
  sizeBytes: z.number().int().positive().max(UPLOAD_LIMITS.story.maxBytes),
});

/**
 * Starts a video story: records it and returns a Tus session straight to Bunny (stories collection).
 * It shows once encoded, for 24 hours; verified creators only.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const limit = await checkRateLimit(`story:${user.id}`, 30, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many stories. Try again later.");
    const { sizeBytes: _size, ...story } = VideoStory.parse(await req.json());
    const result = await openVideoStoryUpload(user.id, story);
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "stories/upload-session");
  }
}
