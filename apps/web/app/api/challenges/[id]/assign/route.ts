import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { assignChallenge } from "@orochia/payments";
import { requireUserWithRole } from "@/lib/auth";
import { announceAccepted, challengeHttpError, challengeIdOr404 } from "@/lib/challenges";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Assign = z.object({ applicationId: z.string().uuid() });

/** The author of an open call picks one applicant, who now has the delivery window to make it. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = challengeIdOr404((await props.params).id);
    const { applicationId } = Assign.parse(await req.json());
    const { challenge, notChosen } = await assignChallenge({
      challengeId: id,
      authorId: user.id,
      applicationId,
    });
    after(() => announceAccepted(challenge, "chosen", notChosen));
    return NextResponse.json({ success: true, status: challenge.status });
  } catch (error) {
    const known = challengeHttpError(error);
    if (known) return jsonError(known.status, known.message, known.extra);
    return errorResponse(error, "challenges/assign");
  }
}
