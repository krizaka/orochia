import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, videos } from "@orochia/db";
import { eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("remove"), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("restore") }),
]);

/** Takes a video down (DMCA, terms, a confirmed report) with a recorded reason, or restores it. */
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    await requireUserWithRole(["ADMIN"]);
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Video not found");
    const input = Action.parse(await req.json());
    const [row] = await db
      .update(videos)
      .set(
        input.action === "remove"
          ? { removedAt: new Date(), removalReason: input.reason, updatedAt: new Date() }
          : { removedAt: null, removalReason: null, updatedAt: new Date() },
      )
      .where(eq(videos.id, id.data))
      .returning({ id: videos.id });
    if (!row) return jsonError(404, "Video not found");
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "admin/videos/patch");
  }
}
