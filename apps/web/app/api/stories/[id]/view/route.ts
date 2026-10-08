import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { recordStoryView } from "@/lib/stories";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Counts a view of a story you may see — once per viewer, never the creator's own. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Story not found");
    const viewer = await getCurrentUser();
    const counted = await recordStoryView(id.data, viewer?.id ?? null, {
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ success: true, counted });
  } catch (error) {
    return errorResponse(error, "stories/view");
  }
}
