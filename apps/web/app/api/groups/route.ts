import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { createGroup } from "@/lib/groups";
import { errorResponse } from "@/lib/http";
import { limitAction } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Body = z.object({ title: z.string().trim().min(1).max(200), memberIds: z.array(z.string().uuid()).min(1).max(49) });

/** Creates a group (the caller is its owner); the members must be the caller's contacts (or, for a creator, approved fans). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    await limitAction("group-create", req, user.id, { perUser: [10, 24 * 60 * 60], perIp: [30, 24 * 60 * 60] }, "Too many new groups. Try again tomorrow.");
    const body = Body.parse(await req.json());
    const conversationId = await createGroup(user.id, body);
    return NextResponse.json({ success: true, conversationId }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "groups");
  }
}
