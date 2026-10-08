import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { markDraftUploaded } from "@/lib/video-drafts";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Tells that a draft's original clip is fully sent, so it can be opened again before Bunny finishes processing. */
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Draft not found");
    await markDraftUploaded(user.id, id.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/drafts/id/uploaded");
  }
}
