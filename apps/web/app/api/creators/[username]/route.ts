import { NextRequest, NextResponse } from "next/server";
import { creatorByUsername, creatorVideos } from "@/lib/queries";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { username: string } }) {
  try {
    const creator = await creatorByUsername(params.username.toLowerCase());
    if (!creator) return jsonError(404, "Creator not found");
    return NextResponse.json({ success: true, creator, videos: await creatorVideos(creator.id) });
  } catch (error) {
    return errorResponse(error, "creators");
  }
}
