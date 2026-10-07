import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { decideFollower } from "@/lib/social";

export const dynamic = "force-dynamic";

const Decision = z.object({ action: z.enum(["approve", "remove"]) });

/** A creator approves a follower (opening followers-only videos to them) or removes them. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUserWithRole(["CREATOR"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Follower not found");
    const { action } = Decision.parse(await req.json());
    await decideFollower(user.id, id.data, action);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/followers/patch");
  }
}
