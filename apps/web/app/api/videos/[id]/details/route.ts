import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { videoDetails } from "@/lib/queries";
import { reconcileVideos } from "@/lib/video-reconcile";
import { getCurrentUser } from "@/lib/auth";
import { hasLiked } from "@/lib/engagement";
import { adultViewer, evaluateVideoAccess } from "@/lib/access";
import { AGE_CHECK_REQUIRED } from "@/lib/adult-access";
import { moreLikeThis } from "@/lib/recommendations/recommendations.shelves";
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
    let video = await videoDetails(id.data, viewer?.isAgeVerified === true);
    if (!video) return jsonError(404, "Video not found");
    // A lost Bunny webhook must not leave an upload polled by its id unsettled until the creator opens the dashboard
    // (orochia#277): ask Bunny about this one video, then read it again.
    if (video.status === "PENDING_UPLOAD" || video.status === "PROCESSING") {
      const { settled } = await reconcileVideos({ videoId: video.id, limit: 1 }).catch(() => ({ settled: 0 }));
      if (settled > 0) video = (await videoDetails(id.data, viewer?.isAgeVerified === true)) ?? video;
    }
    // An invited-only video does not exist for those it was not shared with.
    if (video.visibility === "INVITED_ONLY" && !(await evaluateVideoAccess(video.id, viewer?.id)).allowed) {
      return jsonError(404, "Video not found");
    }
    // 18+: beyond the veiled summary (title, creator, rating, veil), nothing for a visitor or an unchecked account.
    if (video.isAdult && viewer?.id !== video.creatorId && !(await adultViewer(viewer?.id))?.isAgeVerified) {
      const { description: _d, creatorBio: _b, moreFromCreator: _m, ...summary } = video;
      return NextResponse.json({ success: true, gated: true, code: AGE_CHECK_REQUIRED, video: { ...summary, isBlurred: true, similar: [] }, liked: false });
    }
    const [liked, similar] = await Promise.all([hasLiked(viewer?.id ?? null, video.id), moreLikeThis(video.id, viewer, new Date()).then((shelf) => shelf.videos)]);
    // Ownership is decided here, from the session and the row: the page only draws the owner view when it is told so.
    const isOwner = viewer?.id === video.creatorId;
    return NextResponse.json({ success: true, video: { ...video, isOwner, similar }, liked });
  } catch (error) {
    return errorResponse(error, "videos/details");
  }
}
