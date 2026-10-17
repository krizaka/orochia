import { pledgeChallenge } from "@orochia/payments";
import { after,NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertAdultAccessToChallenge } from "@/lib/access";
import { requireUserWithRole } from "@/lib/auth";
import { announcePledge, challengeHttpError, challengeIdOr404, notifyPledge } from "@/lib/challenges";
import { errorResponse, jsonError } from "@/lib/http";
import { getI18n } from "@/lib/i18n-server";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Pledge = z.object({ amountCents: z.number().int().positive() });

/** Pledges Orochia credits to an open challenge; they are held until it is delivered and come back if it is not. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { t } = await getI18n();
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const id = challengeIdOr404((await props.params).id);
    await enforceRateLimit(`pledge:${user.id}`, 30, 60, t("challenge.errors.TOO_MANY"));
    const { amountCents } = Pledge.parse(await req.json());
    await assertAdultAccessToChallenge(id, user.id);
    const outcome = await pledgeChallenge({
      challengeId: id,
      backerId: user.id,
      amountCents,
    });
    const alias = await announcePledge({
      challenge: outcome.challenge,
      pledgeId: outcome.pledge.id,
      backerId: user.id,
      amountCents,
      createdAt: outcome.pledge.createdAt,
      reachedGoal: outcome.reachedGoal,
    });
    after(() =>
      notifyPledge({
        challenge: outcome.challenge,
        backerId: user.id,
        amountCents,
        reachedGoal: outcome.reachedGoal,
      }),
    );
    return NextResponse.json({
      success: true,
      alias,
      balanceCents: outcome.balanceCents,
      reachedGoal: outcome.reachedGoal,
    });
  } catch (error) {
    const known = await challengeHttpError(error);
    if (known) return jsonError(known.status, known.message, known.extra);
    return errorResponse(error, "challenges/pledge");
  }
}
