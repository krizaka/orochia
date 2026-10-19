import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { reportContext } from "@/lib/conversation-moderation";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The message a report names, with ten messages either side (a direct or a group conversation) — and no more. */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const id = z.string().uuid().safeParse((await props.params).id);
    if (!id.success) return jsonError(404, "Report not found");
    return NextResponse.json({ success: true, context: await reportContext(id.data) });
  } catch (error) {
    return errorResponse(error, "admin/reports/context");
  }
}
