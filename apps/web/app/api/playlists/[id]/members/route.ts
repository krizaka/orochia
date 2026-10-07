import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { addMember, listMembers, removeMember } from "@/lib/playlists";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Invite = z.object({ username: z.string().trim().toLowerCase().min(1).max(50) });

async function context(params: Promise<{ id: string }>) {
  const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
  const id = z.string().uuid().safeParse((await params).id);
  return { user, id: id.success ? id.data : null };
}

/** The accounts invited to your collection (owner only). */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { user, id } = await context(props.params);
    if (!id) return jsonError(404, "Playlist not found");
    return NextResponse.json({ success: true, members: await listMembers(user.id, id) });
  } catch (error) {
    return errorResponse(error, "playlists/members/get");
  }
}

/** Invites an account to your collection by username (owner only, idempotent). */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { user, id } = await context(props.params);
    if (!id) return jsonError(404, "Playlist not found");
    const limit = await checkRateLimit(`invite:${user.id}`, 60, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many requests. Try again later.");
    const { username } = Invite.parse(await req.json());
    return NextResponse.json({ success: true, member: await addMember(user.id, id, username) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "playlists/members/post");
  }
}

/** Withdraws an invitation (owner only). */
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { user, id } = await context(props.params);
    if (!id) return jsonError(404, "Playlist not found");
    const userId = z.string().uuid().safeParse(req.nextUrl.searchParams.get("userId"));
    if (!userId.success) return jsonError(404, "Member not found");
    await removeMember(user.id, id, userId.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "playlists/members/delete");
  }
}
