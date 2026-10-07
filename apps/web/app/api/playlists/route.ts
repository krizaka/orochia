import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";
import { createPlaylist, myPlaylists } from "@/lib/playlists";

export const dynamic = "force-dynamic";

const Create = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullish(),
  visibility: z.enum(["PUBLIC", "APPROVED_FOLLOWERS_ONLY", "CONTACTS_ONLY", "INVITED_ONLY", "PRIVATE"]).optional(),
});

/** Your playlists, most recently changed first. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    return NextResponse.json({ success: true, playlists: await myPlaylists(user.id) });
  } catch (error) {
    return errorResponse(error, "playlists/get");
  }
}

/** Creates a playlist. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const limit = await checkRateLimit(`playlist:${user.id}`, 30, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many requests. Try again later.");
    const playlist = await createPlaylist(user.id, Create.parse(await req.json()));
    return NextResponse.json({ success: true, playlist }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "playlists/post");
  }
}
