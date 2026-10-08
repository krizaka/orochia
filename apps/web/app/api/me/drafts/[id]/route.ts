import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { deleteDraft, getDraft, updateDraft } from "@/lib/video-drafts";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Update = z.object({ edit: z.record(z.unknown()).optional(), details: z.record(z.unknown()).optional() });

const draftId = async (props: { params: Promise<{ id: string }> }) => z.string().uuid().safeParse((await props.params).id);

/** One of your drafts, with a short-lived link to its original clip. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const id = await draftId(props);
    if (!id.success) return jsonError(404, "Draft not found");
    return NextResponse.json({ success: true, draft: await getDraft(user.id, id.data) });
  } catch (error) {
    return errorResponse(error, "me/drafts/id/get");
  }
}

/** Saves new edit settings or form values on a draft (the clip is not sent again); it is kept longer. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const id = await draftId(props);
    if (!id.success) return jsonError(404, "Draft not found");
    return NextResponse.json({ success: true, draft: await updateDraft(user.id, id.data, Update.parse(await req.json())) });
  } catch (error) {
    return errorResponse(error, "me/drafts/id/patch");
  }
}

/** Deletes one of your drafts with its clip and music. */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const id = await draftId(props);
    if (!id.success) return jsonError(404, "Draft not found");
    await deleteDraft(user.id, id.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/drafts/id/delete");
  }
}
