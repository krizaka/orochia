import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { closeGroup, listMembers, renameGroup } from "@/lib/groups";
import { errorResponse, jsonError } from "@/lib/http";
import { limitAction } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; userId?: string }> };

async function groupId(ctx: Ctx) {
  const id = z.string().uuid().safeParse((await ctx.params).id);
  return id.success ? id.data : null;
}

/** The group: its name, the caller's role and mute, its members. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const id = await groupId(ctx);
    if (!id) return jsonError(404, "Conversation not found");
    return NextResponse.json({ success: true, group: await listMembers(user.id, id) });
  } catch (error) {
    return errorResponse(error, "groups/[id]");
  }
}

/** Renames the group (owner). */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    await limitAction("group-edit", req, user.id, { perUser: [30, 60 * 60] });
    const id = await groupId(ctx);
    if (!id) return jsonError(404, "Conversation not found");
    const { title } = z.object({ title: z.string().trim().min(1).max(200) }).parse(await req.json());
    await renameGroup(user.id, id, title);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "groups/[id]");
  }
}

/** Closes the group (owner): nobody writes any more. */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    await limitAction("group-edit", req, user.id, { perUser: [30, 60 * 60] });
    const id = await groupId(ctx);
    if (!id) return jsonError(404, "Conversation not found");
    await closeGroup(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "groups/[id]");
  }
}
