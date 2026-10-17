import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { moderateConversation } from "@/lib/conversation-moderation";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("remove_message"), messageId: z.string().uuid() }),
  z.object({ action: z.literal("remove_member"), userId: z.string().uuid() }),
  z.object({ action: z.literal("archive") }),
]);

/** Acts on a reported conversation: remove a message, remove a member of a group, close a group. Operators only. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Conversation not found");
    await moderateConversation({ conversationId: id.data, ...Body.parse(await req.json()) });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "admin/conversations/moderate");
  }
}
