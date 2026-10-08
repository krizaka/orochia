import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, users } from "@orochia/db";
import { eq, sql } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { listConversations, getOrCreateConversation } from "@/lib/messaging";
import { errorResponse, HttpError } from "@/lib/http";

export const dynamic = "force-dynamic";

const CreateConversationSchema = z.object({
  recipientId: z.string().uuid().optional(),
  recipientUsername: z.string().trim().optional(),
});

/** Lists the signed-in user's active direct conversations. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const conversations = await listConversations(user.id);
    return NextResponse.json({ success: true, conversations });
  } catch (error) {
    return errorResponse(error, "conversations");
  }
}

/** Starts or retrieves a conversation with a specified user. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const body = CreateConversationSchema.parse(await req.json());

    let targetUserId = body.recipientId;

    if (!targetUserId && body.recipientUsername) {
      const [target] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(sql`lower(${users.username})`, body.recipientUsername.toLowerCase()))
        .limit(1);
      if (!target) throw new HttpError(404, "User not found");
      targetUserId = target.id;
    }

    if (!targetUserId) {
      throw new HttpError(400, "recipientId or recipientUsername is required");
    }

    const conversationId = await getOrCreateConversation(user.id, targetUserId);
    return NextResponse.json({ success: true, conversationId }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "conversations");
  }
}
