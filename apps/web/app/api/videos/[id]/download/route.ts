import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, videos } from "@orochia/db";
import { signBunnyDownloadUrl } from "@orochia/media";
import { eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { canDownloadVideo } from "@/lib/access";
import { bunnyStreamConfig } from "@/lib/env";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** A five-minute signed link to the video's MP4 file, for its author and for a buyer whose grant includes downloading. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Video not found");
    if (!(await canDownloadVideo(id.data, user.id))) return jsonError(403, "Downloading is not part of your access to this video");
    const [video] = await db.select({ guid: videos.bunnyVideoId, status: videos.status, resolutions: videos.resolutions }).from(videos).where(eq(videos.id, id.data)).limit(1);
    if (!video || video.status !== "READY") return jsonError(409, "Video is not ready yet");
    const config = bunnyStreamConfig();
    return NextResponse.json({ success: true, url: signBunnyDownloadUrl({ hostname: config.hostname, videoGuid: video.guid, tokenAuthKey: config.tokenAuthKey, resolutions: video.resolutions }) });
  } catch (error) {
    return errorResponse(error, "videos/download");
  }
}
