import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { answerRequest } from "@orochia/payments";
import { requireUserWithRole } from "@/lib/auth";
import { announceAccepted, announceReleased, challengeHttpError, challengeIdOr404 } from "@/lib/challenges";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Answer = z.object({ accept: z.boolean() });

/** The creator a request was sent to accepts it (and must deliver in time) or declines it (every pledge comes back). */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR"]);
    const id = challengeIdOr404((await props.params).id);
    const { accept } = Answer.parse(await req.json());
    const outcome = await answerRequest({
      challengeId: id,
      creatorId: user.id,
      accept,
    });
    if (outcome.kind === "ACCEPTED") after(() => announceAccepted(outcome.challenge, "accepted"));
    else after(() => announceReleased(outcome.challenge, outcome.releasedTo));
    return NextResponse.json({
      success: true,
      status: outcome.challenge.status,
    });
  } catch (error) {
    const known = challengeHttpError(error);
    if (known) return jsonError(known.status, known.message, known.extra);
    return errorResponse(error, "challenges/answer");
  }
}
