import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { videoDetails } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { hasLiked } from "@/lib/engagement";
import { evaluateVideoAccess } from "@/lib/access";
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
    const video = await videoDetails(id.data);
    if (!video) return jsonError(404, "Video not found");
    const viewer = await getCurrentUser();
    // An invited-only video does not exist for those it was not shared with.
    if (video.visibility === "INVITED_ONLY" && !(await evaluateVideoAccess(video.id, viewer?.id)).allowed) {
      return jsonError(404, "Video not found");
    }
    return NextResponse.json({ success: true, video, liked: await hasLiked(viewer?.id ?? null, video.id) });
  } catch (error) {
    return errorResponse(error, "videos/details");
  }
}
