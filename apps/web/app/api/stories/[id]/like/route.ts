import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { setStoryLike } from "@/lib/stories";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

async function toggle(params: Promise<{ id: string }>, liked: boolean, context: string) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse((await params).id);
    if (!id.success) return jsonError(404, "Story not found");
    return NextResponse.json({ success: true, ...(await setStoryLike(id.data, user.id, liked)) });
  } catch (error) {
    return errorResponse(error, context);
  }
}

/** Likes a story you may see (idempotent). */
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  return toggle(props.params, true, "stories/like/post");
}

/** Removes your like (idempotent). */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  return toggle(props.params, false, "stories/like/delete");
}
