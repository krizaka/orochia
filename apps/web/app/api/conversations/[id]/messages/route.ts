import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { conversationFor, getConversationMessages, MESSAGE_MAX_LENGTH, sendMessage } from "@/lib/messaging";
import { limitAction } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SendMessageSchema = z.object({
  content: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
  /** The app's id for this message: sending it again (a retry after a lost answer) never makes a second message. */
  clientId: z.string().uuid().optional(),
});

const Page = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/** Lists messages in a conversation (latest page, or `?before=<seq>` to scroll back) and marks the latest as read. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const id = z.string().uuid().safeParse((await params).id);
    if (!id.success) return jsonError(404, "Conversation not found");
    const page = Page.parse(Object.fromEntries(req.nextUrl.searchParams));
    const { messages, hasMore } = await getConversationMessages(id.data, user.id, page);
    return NextResponse.json({ success: true, messages, hasMore });
  } catch (error) {
    return errorResponse(error, "conversations/[id]/messages");
  }
}

/** Sends a direct message in a conversation (idempotent per `clientId`: a retry answers the stored message). */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    // Bursts (a message a second for a minute) and volume (per hour), per account and per IP.
    await limitAction("message-burst", req, user.id, { perUser: [20, 60] });
    await limitAction("message", req, user.id, { perUser: [300, 60 * 60], perIp: [600, 60 * 60] }, "Too many messages. Slow down.");
    const id = z.string().uuid().safeParse((await params).id);
    if (!id.success) return jsonError(404, "Conversation not found");
    const body = SendMessageSchema.parse(await req.json());

    const { otherId } = await conversationFor(id.data, user.id);
    const { duplicate, ...message } = await sendMessage(user.id, otherId, body.content, { clientId: body.clientId });

    return NextResponse.json({ success: true, message, duplicate: Boolean(duplicate) }, { status: duplicate ? 200 : 201 });
  } catch (error) {
    return errorResponse(error, "conversations/[id]/messages");
  }
}
