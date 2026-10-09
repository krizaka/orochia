import { NextRequest, NextResponse, after } from "next/server";
import { startGoal } from "@orochia/payments";
import { requireUserWithRole } from "@/lib/auth";
import { announceAccepted, challengeHttpError, challengeIdOr404 } from "@/lib/challenges";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** A goal's creator starts it as soon as the goal is reached (pledging stops; the delivery window begins). */
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR"]);
    const id = challengeIdOr404((await props.params).id);
    const challenge = await startGoal({ challengeId: id, creatorId: user.id });
    after(() => announceAccepted(challenge, "accepted"));
    return NextResponse.json({ success: true, status: challenge.status });
  } catch (error) {
    const known = challengeHttpError(error);
    if (known) return jsonError(known.status, known.message, known.extra);
    return errorResponse(error, "challenges/start");
  }
}
