import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { STORY_AUDIENCES, removeStory, updateStoryAudience } from "@/lib/stories";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const AudienceChange = z.object({
  audience: z.enum(STORY_AUDIENCES),
  audienceListId: z.string().uuid().nullish(),
});

/** Changes who sees a live story (its creator only; a story delivered for a challenge keeps its backers). */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Story not found");
    const body = AudienceChange.parse(await req.json());
    return NextResponse.json({ success: true, ...(await updateStoryAudience(id.data, user.id, body.audience, body.audienceListId)) });
  } catch (error) {
    return errorResponse(error, "stories/audience");
  }
}

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
