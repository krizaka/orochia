import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, requireUserWithRole } from "@/lib/auth";
import { COMMENT_MAX_LENGTH, addComment, listComments } from "@/lib/engagement";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Create = z.object({
  body: z.string().trim().min(1).max(COMMENT_MAX_LENGTH),
  parentId: z.string().uuid().nullish(),
});

/** The comments of a video you may watch, oldest first; removed ones keep their place without text. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Video not found");
    const viewer = await getCurrentUser();
    return NextResponse.json({ success: true, comments: await listComments(id.data, viewer) });
  } catch (error) {
    return errorResponse(error, "videos/comments/get");
  }
}

/** Comments on a video you may watch, or replies to one of its comments. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Video not found");
    const limit = await checkRateLimit(`comment:${user.id}`, 30, 10 * 60);
    if (!limit.success) return jsonError(429, "Too many requests. Try again later.");
    const comment = await addComment(user, id.data, Create.parse(await req.json()));
    return NextResponse.json({ success: true, comment }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "videos/comments/post");
  }
}
