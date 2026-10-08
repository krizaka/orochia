import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { blockUser, toggleBlockUser, unblockUser } from "@/lib/messaging";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ username: string }>;
}

const BlockSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

/** Blocks or unblocks a user: toggles block state on POST. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const { username } = await params;
    const body = BlockSchema.parse(await req.json().catch(() => ({})));
    const blocked = await toggleBlockUser(user.id, username, body.reason);
    return NextResponse.json({ success: true, blocked });
  } catch (error) {
    return errorResponse(error, "users/[username]/block");
  }
}

/** Unblocks a previously blocked user. */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const { username } = await params;
    await unblockUser(user.id, username);
    return NextResponse.json({ success: true, blocked: false });
  } catch (error) {
    return errorResponse(error, "users/[username]/block");
  }
}
