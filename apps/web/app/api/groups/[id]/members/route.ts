import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { addMembers } from "@/lib/groups";
import { errorResponse, jsonError } from "@/lib/http";
import { limitAction } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; userId?: string }> };

async function groupId(ctx: Ctx) {
  const id = z.string().uuid().safeParse((await ctx.params).id);
  return id.success ? id.data : null;
}

/** Adds members (owner): contacts, up to 50 in all. */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    await limitAction("group-members", req, user.id, { perUser: [30, 60 * 60] });
    const id = await groupId(ctx);
    if (!id) return jsonError(404, "Conversation not found");
    const { memberIds } = z.object({ memberIds: z.array(z.string().uuid()).min(1).max(49) }).parse(await req.json());
    await addMembers(user.id, id, memberIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "groups/[id]/members");
  }
}
