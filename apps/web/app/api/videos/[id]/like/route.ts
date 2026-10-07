import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { setLike } from "@/lib/engagement";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

async function toggle(params: Promise<{ id: string }>, liked: boolean, context: string) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse((await params).id);
    if (!id.success) return jsonError(404, "Video not found");
    const limit = await checkRateLimit(`like:${user.id}`, 120, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many requests. Try again later.");
    return NextResponse.json({ success: true, ...(await setLike(user, id.data, liked)) });
  } catch (error) {
    return errorResponse(error, context);
  }
}

/** Likes a video you may watch (idempotent). */
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  return toggle(props.params, true, "videos/like/post");
}

/** Removes your like (idempotent). */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  return toggle(props.params, false, "videos/like/delete");
}
