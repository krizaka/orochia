import { NextRequest, NextResponse, after } from "next/server";
import { cancelChallenge } from "@orochia/payments";
import { requireUserWithRole } from "@/lib/auth";
import { announceReleased, challengeHttpError, challengeIdOr404 } from "@/lib/challenges";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** The author withdraws an open challenge (a goal, a request not answered yet, an open call): every pledge comes back. */
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = challengeIdOr404((await props.params).id);
    const { challenge, releasedTo } = await cancelChallenge({
      challengeId: id,
      authorId: user.id,
      reason: "Withdrawn by its author",
    });
    after(() => announceReleased(challenge, releasedTo));
    return NextResponse.json({ success: true, status: challenge.status });
  } catch (error) {
    const known = challengeHttpError(error);
    if (known) return jsonError(known.status, known.message, known.extra);
    return errorResponse(error, "challenges/cancel");
  }
}
