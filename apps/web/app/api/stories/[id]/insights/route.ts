import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { storyInsights } from "@/lib/stories";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** A story's activity for its creator: views (accounts named, visitors counted), likes, tips and who sent them. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Story not found");
    return NextResponse.json({ success: true, insights: await storyInsights(id.data, user.id) });
  } catch (error) {
    return errorResponse(error, "stories/insights");
  }
}
