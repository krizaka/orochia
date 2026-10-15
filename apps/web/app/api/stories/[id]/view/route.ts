import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { errorResponse, jsonError } from "@/lib/http";
import { publicActionsOn } from "@/lib/public-actions";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordStoryView } from "@/lib/stories";

export const dynamic = "force-dynamic";

/** Counts a view of a story you may see — once per viewer, never the creator's own. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Story not found");
    const viewer = await getCurrentUser();
    // A signed-out visitor on a development deployment is answered but not counted (APP_PUBLIC_ACTIONS=off).
    if (!viewer && !publicActionsOn()) return new NextResponse(null, { status: 204 });
    // Every environment: at most 120 views an hour from one address, so a counter cannot be inflated from one place.
    const ip = clientIp(req.headers) ?? "unknown";
    if (!(await checkRateLimit(`story-view:ip:${ip}`, 120, 3600)).success) return jsonError(429, "Too many requests");
    const counted = await recordStoryView(id.data, viewer?.id ?? null, {
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
    });
    return NextResponse.json({ success: true, counted });
  } catch (error) {
    return errorResponse(error, "stories/view");
  }
}
