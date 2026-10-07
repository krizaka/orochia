import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { videoDetails } from "@/lib/queries";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** A video's public metadata; the stream itself is only served by /stream after authorisation. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Video not found");
    const video = await videoDetails(id.data);
    if (!video) return jsonError(404, "Video not found");
    return NextResponse.json({ success: true, video });
  } catch (error) {
    return errorResponse(error, "videos/details");
  }
}
