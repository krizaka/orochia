import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { signalTyping } from "@/lib/messaging";
import { limitAction } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Body = z.object({ typing: z.boolean() });

/** Tells the other participant that the account is typing (or stopped) — live only, never stored. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    // Apps send at most one every 3 s while typing: 40 a minute leaves room and stops a flood.
    await limitAction("typing", req, user.id, { perUser: [40, 60] });
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Conversation not found");
    const { typing } = Body.parse(await req.json());
    await signalTyping(id.data, user.id, typing);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "conversations/[id]/typing");
  }
}
