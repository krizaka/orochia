import { UPLOAD_LIMITS } from "@orochia/media/limits";
import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { limitAction } from "@/lib/rate-limit";
import { assertUploadAllowed, checkPlatformAlerts } from "@/lib/storage-usage";
import { openVideoStoryUpload,STORY_AUDIENCES } from "@/lib/stories";

export const dynamic = "force-dynamic";

const VideoStory = z.object({
  caption: z.string().trim().max(280).nullish(),
  audience: z.enum(STORY_AUDIENCES).default("PUBLIC"),
  audienceListId: z.string().uuid().nullish(),
  /** Size of the clip about to be sent, refused above the story limit. */
  sizeBytes: z.number().int().positive().max(UPLOAD_LIMITS.story.maxBytes),
  /** Its length when the browser read it. */
  durationSeconds: z.number().nonnegative().max(UPLOAD_LIMITS.story.maxSeconds + 60).optional(),
});

/**
 * Starts a video story: records it and returns a Tus session straight to Bunny (stories collection).
 * It shows once encoded, for 24 hours; verified creators only.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    await limitAction("story", req, user.id, { perUser: [30, 60 * 60], perIp: [60, 60 * 60] }, "Too many stories. Try again later.");
    const { sizeBytes, durationSeconds, ...story } = VideoStory.parse(await req.json());
    // Quotas before the Tus signature (lib/storage-usage.ts).
    await assertUploadAllowed(user.id, { kind: "story", sizeBytes, durationSeconds });
    const result = await openVideoStoryUpload(user.id, { ...story, sizeBytes });
    after(() => checkPlatformAlerts());
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "stories/upload-session");
  }
}
