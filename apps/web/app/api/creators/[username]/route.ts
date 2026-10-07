import { NextRequest, NextResponse } from "next/server";
import { creatorByUsername, creatorVideos } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { relationship } from "@/lib/social";
import { publicPlaylists } from "@/lib/playlists";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** A creator's public page: profile, videos, public playlists and, signed in, how you relate to them. */
export async function GET(_req: NextRequest, props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  try {
    const creator = await creatorByUsername(params.username.toLowerCase());
    if (!creator) return jsonError(404, "Creator not found");
    const viewer = await getCurrentUser();
    return NextResponse.json({
      success: true,
      creator,
      videos: await creatorVideos(creator.id),
      playlists: await publicPlaylists(creator.id),
      relationship: viewer && viewer.id !== creator.id ? await relationship(viewer.id, creator.id) : null,
    });
  } catch (error) {
    return errorResponse(error, "creators");
  }
}
