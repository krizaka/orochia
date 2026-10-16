import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { videoDetails } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { hasLiked } from "@/lib/engagement";
import { adultViewer, evaluateVideoAccess } from "@/lib/access";
import { AGE_CHECK_REQUIRED } from "@/lib/adult-access";
import { similarVideos } from "@/lib/explore-semantic";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * A video's public metadata and figures (and whether you liked it); the stream is only served by /stream.
 * Invited-only videos answer 404 to anyone not invited.
 */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Video not found");
    const viewer = await getCurrentUser();
    const video = await videoDetails(id.data, viewer?.isAgeVerified === true);
    if (!video) return jsonError(404, "Video not found");
    // An invited-only video does not exist for those it was not shared with.
    if (video.visibility === "INVITED_ONLY" && !(await evaluateVideoAccess(video.id, viewer?.id)).allowed) {
      return jsonError(404, "Video not found");
    }
    // 18+: beyond the veiled summary (title, creator, rating, veil), nothing for a visitor or an unchecked account.
    if (video.isAdult && viewer?.id !== video.creatorId && !(await adultViewer(viewer?.id))?.isAgeVerified) {
      const { description: _d, creatorBio: _b, moreFromCreator: _m, ...summary } = video;
      return NextResponse.json({ success: true, gated: true, code: AGE_CHECK_REQUIRED, video: { ...summary, isBlurred: true, similar: [] }, liked: false });
    }
    const [liked, similar] = await Promise.all([hasLiked(viewer?.id ?? null, video.id), similarVideos(video.id, viewer)]);
    return NextResponse.json({ success: true, video: { ...video, similar }, liked });
  } catch (error) {
    return errorResponse(error, "videos/details");
  }
}
