import { NextRequest } from "next/server";

import { requireUserWithRole } from "@/lib/auth";
import { parseCursor, userStream } from "@/lib/chat-stream";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * The account's live stream (Server-Sent Events): messages, receipts, typing, unread count, notifications and the
 * presence of its circle; resumes after `Last-Event-ID` (or `?after=<seq>`) without loss.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const cursor = parseCursor(req.headers.get("last-event-id") ?? req.nextUrl.searchParams.get("after"));
    return userStream(user.id, { cursor });
  } catch (error) {
    return errorResponse(error, "conversations/stream");
  }
}
