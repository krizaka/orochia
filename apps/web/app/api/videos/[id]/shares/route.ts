import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { SHARE_CHANNELS, recordShare } from "@/lib/engagement";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Share = z.object({ channel: z.enum(SHARE_CHANNELS).default("LINK") });

/** Counts a share of a video you may watch; the shared link still enforces the video's access. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Video not found");
    const viewer = await getCurrentUser();
    const who = viewer?.id ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "guest";
    const limit = await checkRateLimit(`share:${who}`, 30, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many requests. Try again later.");
    const { channel } = Share.parse(await req.json().catch(() => ({})));
    const result = await recordShare(viewer?.id ?? null, id.data, channel);
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "videos/shares/post");
  }
}
