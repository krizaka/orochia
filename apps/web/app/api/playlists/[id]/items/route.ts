import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { addToPlaylist, removeFromPlaylist } from "@/lib/playlists";

export const dynamic = "force-dynamic";

const Item = z.object({ videoId: z.string().uuid() });

/** Adds a video at the end of a playlist (owner only, idempotent). */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Playlist not found");
    const { videoId } = Item.parse(await req.json());
    await addToPlaylist(user.id, id.data, videoId);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "playlists/items/post");
  }
}

/** Removes a video from a playlist (owner only). */
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Playlist not found");
    const { videoId } = Item.parse({ videoId: req.nextUrl.searchParams.get("videoId") });
    await removeFromPlaylist(user.id, id.data, videoId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "playlists/items/delete");
  }
}
