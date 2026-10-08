import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, conversations } from "@orochia/db";
import { eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { getConversationMessages, sendMessage } from "@/lib/messaging";
import { errorResponse, HttpError } from "@/lib/http";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SendMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});

/** Lists messages in a conversation and marks unread messages as read. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const { id } = await params;

    const messages = await getConversationMessages(id, user.id);
    return NextResponse.json({ success: true, messages });
  } catch (error) {
    return errorResponse(error, "conversations/[id]/messages");
  }
}

/** Sends a direct message in a conversation. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const { id: conversationId } = await params;
    const body = SendMessageSchema.parse(await req.json());

    // Verify conversation exists and user is participant
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (!conv || (conv.participant1Id !== user.id && conv.participant2Id !== user.id)) {
      throw new HttpError(404, "Conversation not found");
    }

    const recipientId = conv.participant1Id === user.id ? conv.participant2Id : conv.participant1Id;
    const message = await sendMessage(user.id, recipientId, body.content);

    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "conversations/[id]/messages");
  }
}
