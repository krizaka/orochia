import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { conversationFor, markRead } from "@/lib/messaging";
import { limitAction } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Body = z.object({ upTo: z.number().int().positive().optional() });

/** Marks a conversation read up to a message (`upTo`, its `seq`; everything when absent): the sender sees "read". */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    await limitAction("message-read", req, user.id, { perUser: [240, 60] });
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Conversation not found");
    const { upTo } = Body.parse(await req.json().catch(() => ({})));
    await conversationFor(id.data, user.id);
    const result = await markRead(id.data, user.id, upTo);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error, "conversations/[id]/read");
  }
}
