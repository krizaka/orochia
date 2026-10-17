import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { createInvite, revokeInvites } from "@/lib/groups";
import { errorResponse, jsonError } from "@/lib/http";
import { limitAction } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; userId?: string }> };

async function groupId(ctx: Ctx) {
  const id = z.string().uuid().safeParse((await ctx.params).id);
  return id.success ? id.data : null;
}

/** A new invite link (owner): the token is shown once, and valid for a week. */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    await limitAction("group-invite", req, user.id, { perUser: [10, 60 * 60] });
    const id = await groupId(ctx);
    if (!id) return jsonError(404, "Conversation not found");
    const invite = await createInvite(user.id, id);
    return NextResponse.json({ success: true, token: invite.token, expiresAt: invite.expiresAt }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "groups/[id]/invites");
  }
}

/** Revokes every open invite (owner). */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    await limitAction("group-invite", req, user.id, { perUser: [10, 60 * 60] });
    const id = await groupId(ctx);
    if (!id) return jsonError(404, "Conversation not found");
    await revokeInvites(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "groups/[id]/invites");
  }
}
