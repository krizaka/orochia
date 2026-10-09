import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { challengeIdOr404, challengeView } from "@/lib/challenges";
import { errorResponse, jsonError } from "@/lib/http";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** A challenge as the viewer sees it: progress, deadlines, backers (aliases), applications and what the viewer may do. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const id = challengeIdOr404((await props.params).id);
    const user = await getCurrentUser();
    const challenge = await challengeView(id, user ? { id: user.id, role: user.role } : null);
    if (!challenge) return jsonError(404, t("challenge.errors.NOT_FOUND"));
    return NextResponse.json({ success: true, challenge });
  } catch (error) {
    return errorResponse(error, "challenges/get");
  }
}
