import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { leaveGroup } from "@/lib/groups";
import { errorResponse, jsonError } from "@/lib/http";
import { limitAction } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; userId?: string }> };

async function groupId(ctx: Ctx) {
  const id = z.string().uuid().safeParse((await ctx.params).id);
  return id.success ? id.data : null;
}

/** Leaves the group (the owner leaving passes it on). */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    await limitAction("group-leave", req, user.id, { perUser: [30, 60 * 60] });
    const id = await groupId(ctx);
    if (!id) return jsonError(404, "Conversation not found");
    await leaveGroup(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "groups/[id]/leave");
  }
}
