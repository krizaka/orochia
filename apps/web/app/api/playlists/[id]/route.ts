import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { deletePlaylist, playlistWithItems, updatePlaylist } from "@/lib/playlists";

export const dynamic = "force-dynamic";

const Patch = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullish(),
  isPrivate: z.boolean().optional(),
});

/** A playlist and its videos (private playlists are visible to their owner only). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Playlist not found");
    const viewer = await getCurrentUser();
    return NextResponse.json({ success: true, playlist: await playlistWithItems(id.data, viewer?.id ?? null) });
  } catch (error) {
    return errorResponse(error, "playlists/id/get");
  }
}

/** Renames a playlist, edits its description or its privacy (owner only). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Playlist not found");
    await updatePlaylist(user.id, id.data, Patch.parse(await req.json()));
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "playlists/id/patch");
  }
}

/** Deletes a playlist (owner only). */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Playlist not found");
    await deletePlaylist(user.id, id.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "playlists/id/delete");
  }
}
