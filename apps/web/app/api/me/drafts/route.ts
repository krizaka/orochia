import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UPLOAD_LIMITS } from "@orochia/media";
import { requireUserWithRole } from "@/lib/auth";
import { DRAFT_KINDS, createDraft, listDrafts } from "@/lib/video-drafts";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Create = z.object({
  kind: z.enum(DRAFT_KINDS),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().regex(/^video\/[\w.+-]+$/),
  sizeBytes: z.number().int().positive().max(UPLOAD_LIMITS.draft.maxBytes),
  edit: z.record(z.unknown()),
  details: z.record(z.unknown()).optional(),
});

/** Your editor drafts (newest first), with a short-lived link to each original clip; expired ones are removed. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const kind = z.enum(DRAFT_KINDS).optional().safeParse(req.nextUrl.searchParams.get("kind") ?? undefined);
    return NextResponse.json({ success: true, drafts: await listDrafts(user.id, kind.success ? kind.data : undefined) });
  } catch (error) {
    return errorResponse(error, "me/drafts/get");
  }
}

/** Keeps an edit as a draft: records its settings and returns a Tus session to send the original clip straight to Bunny. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const limit = await checkRateLimit(`draft:${user.id}`, 20, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many drafts saved. Try again later.");
    return NextResponse.json({ success: true, ...(await createDraft(user.id, Create.parse(await req.json()))) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "me/drafts/post");
  }
}
