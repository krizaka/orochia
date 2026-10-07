import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { removeComment } from "@/lib/engagement";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Removes a comment: its author, the video's creator or an operator. */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string; commentId: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    const commentId = z.string().uuid().safeParse(params.commentId);
    if (!id.success || !commentId.success) return jsonError(404, "Comment not found");
    await removeComment(user, id.data, commentId.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "videos/comments/delete");
  }
}
