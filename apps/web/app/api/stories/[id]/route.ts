import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { removeStory } from "@/lib/stories";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Withdraws a story: its creator or an operator. */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Story not found");
    await removeStory(id.data, user);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "stories/delete");
  }
}
