import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { joinByInvite } from "@/lib/groups";
import { errorResponse } from "@/lib/http";
import { limitAction } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(16).max(128) });

/** Joins a group with an invite token (`/messages/join/<token>`): the answer is the conversation to open. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    await limitAction("group-join", req, user.id, { perUser: [20, 60 * 60], perIp: [60, 60 * 60] }, "Too many attempts. Try again later.");
    const { token } = Body.parse(await req.json());
    const conversationId = await joinByInvite(user.id, token);
    return NextResponse.json({ success: true, conversationId });
  } catch (error) {
    return errorResponse(error, "groups/join");
  }
}
