import { applyToChallenge } from "@orochia/payments";
import { after,NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { challengeHttpError, challengeIdOr404, notifyApplied } from "@/lib/challenges";
import { errorResponse, jsonError } from "@/lib/http";
import { getI18n } from "@/lib/i18n-server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Apply = z.object({ note: z.string().max(280).optional() });

/** A verified creator applies to take an open call, with a short note for its author. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { t } = await getI18n();
  try {
    const user = await requireUserWithRole(["CREATOR"]);
    const id = challengeIdOr404((await props.params).id);
    await enforceRateLimit(`challenge-apply:${user.id}`, 30, 60 * 60, t("challenge.errors.TOO_MANY"));
    const { note } = Apply.parse(await req.json());
    const { challenge, application } = await applyToChallenge({
      challengeId: id,
      creatorId: user.id,
      note,
    });
    after(() => notifyApplied(challenge, user.id));
    return NextResponse.json({ success: true, applicationId: application.id }, { status: 201 });
  } catch (error) {
    const known = await challengeHttpError(error);
    if (known) return jsonError(known.status, known.message, known.extra);
    return errorResponse(error, "challenges/apply");
  }
}
