import { NextRequest, NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/redis";
import { errorResponse, jsonError } from "@/lib/http";
import { follow, unfollow } from "@/lib/social";

export const dynamic = "force-dynamic";

/** Follows a creator; the follow stays PENDING until the creator approves it. */
export async function POST(_req: NextRequest, { params }: { params: { username: string } }) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const limit = await checkRateLimit(`follow:${user.id}`, 60, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many requests. Try again later.");
    return NextResponse.json({ success: true, follow: await follow(user.id, params.username) });
  } catch (error) {
    return errorResponse(error, "creators/follow/post");
  }
}

/** Unfollows a creator. */
export async function DELETE(_req: NextRequest, { params }: { params: { username: string } }) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    await unfollow(user.id, params.username);
    return NextResponse.json({ success: true, follow: null });
  } catch (error) {
    return errorResponse(error, "creators/follow/delete");
  }
}
