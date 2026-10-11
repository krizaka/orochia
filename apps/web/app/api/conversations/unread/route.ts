import { NextResponse } from "next/server";

import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { unreadTotal } from "@/lib/messaging";

export const dynamic = "force-dynamic";

/** The account's unread messages, all conversations (the badge; kept live by the `unread` event of the stream). */
export async function GET() {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    return NextResponse.json({ success: true, total: await unreadTotal(user.id) });
  } catch (error) {
    return errorResponse(error, "conversations/unread");
  }
}
