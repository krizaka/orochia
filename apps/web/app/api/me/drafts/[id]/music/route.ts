import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { draftMusicRef, setDraftMusic } from "@/lib/video-drafts";
import { readPrivateFile } from "@/lib/storage";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const draftId = async (props: { params: Promise<{ id: string }> }) => z.string().uuid().safeParse((await props.params).id);

/** The music track of one of your drafts (private: served to you only). */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const id = await draftId(props);
    if (!id.success) return jsonError(404, "Draft not found");
    const { ref, name } = await draftMusicRef(user.id, id.data);
    const file = await readPrivateFile(ref);
    if (!file) return jsonError(404, "Music not found");
    return new NextResponse(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error, "me/drafts/id/music/get");
  }
}

/** Keeps (or replaces) the music track of a draft — MP3, M4A, AAC, WAV or OGG up to 25 MB. */
export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const id = await draftId(props);
    if (!id.success) return jsonError(404, "Draft not found");
    const limit = await checkRateLimit(`draft-music:${user.id}`, 30, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many uploads. Try again later.");
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return jsonError(400, "No file provided");
    return NextResponse.json({ success: true, ...(await setDraftMusic(user.id, id.data, file)) });
  } catch (error) {
    return errorResponse(error, "me/drafts/id/music/put");
  }
}

/** Removes the music track of a draft. */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const id = await draftId(props);
    if (!id.success) return jsonError(404, "Draft not found");
    return NextResponse.json({ success: true, ...(await setDraftMusic(user.id, id.data, null)) });
  } catch (error) {
    return errorResponse(error, "me/drafts/id/music/delete");
  }
}
