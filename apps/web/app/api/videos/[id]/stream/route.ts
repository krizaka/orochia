import { signBunnyFeedMp4Url } from "@orochia/media";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { bunnyStreamConfig } from "@/lib/env";
import { errorResponse, jsonError } from "@/lib/http";
import { resolveStreamAccess } from "@/lib/stream-access";

export const dynamic = "force-dynamic";

/** Authorises a viewer and returns a short-lived signed HLS URL (AGENTS.md §2.A). The watch page signs on the server through the same function. */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Video not found");
    const user = await getCurrentUser();

    const { status, body, video } = await resolveStreamAccess(id.data, user, req.headers);
    if (status === 409) return jsonError(409, "Video is not ready yet");
    if (!body.allowed || !video) return NextResponse.json(body, { status });

    // The phone's vertical feed plays this light MP4 (same access decision as the HLS above, ten minutes).
    const config = bunnyStreamConfig();
    const feedMp4Url = signBunnyFeedMp4Url({ hostname: config.hostname, videoGuid: video.bunnyVideoId, tokenAuthKey: config.tokenAuthKey, resolutions: video.resolutions });

    return NextResponse.json({ ...body, feedMp4Url, videoId: video.id, title: video.title });
  } catch (error) {
    return errorResponse(error, "videos/stream");
  }
}
