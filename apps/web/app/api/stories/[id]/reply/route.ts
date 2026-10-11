import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { replyToStory } from "@/lib/stories";

export const dynamic = "force-dynamic";

const Reply = z.object({ content: z.string().trim().min(1).max(1000) });

/** Answers a story privately: a direct message to its creator, linked to the story (blocks and message privacy apply). */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Story not found");
    await enforceRateLimit(`story-reply:${user.id}`, 60, 60 * 60, "Too many replies. Try again later.");
    const { content } = Reply.parse(await req.json());
    const message = await replyToStory(id.data, user.id, content);
    return NextResponse.json({ success: true, message, conversationId: message.conversationId }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "stories/reply");
  }
}
