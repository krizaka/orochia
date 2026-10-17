import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { removeMember } from "@/lib/groups";
import { errorResponse, jsonError } from "@/lib/http";
import { limitAction } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; userId?: string }> };

async function groupId(ctx: Ctx) {
  const id = z.string().uuid().safeParse((await ctx.params).id);
  return id.success ? id.data : null;
}

/** Removes a member (owner). */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    await limitAction("group-members", req, user.id, { perUser: [30, 60 * 60] });
    const id = await groupId(ctx);
    const target = z.string().uuid().safeParse((await ctx.params).userId);
    if (!id || !target.success) return jsonError(404, "Conversation not found");
    await removeMember(user.id, id, target.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "groups/[id]/members/[userId]");
  }
}
