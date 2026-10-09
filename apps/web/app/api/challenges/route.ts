import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createChallenge } from "@orochia/payments";
import { getCurrentUser, requireUserWithRole } from "@/lib/auth";
import { CHALLENGE_TABS, PERSONAL_CHALLENGE_TABS, challengeHttpError, creatorIdByUsername, listChallenges, notifyCreated } from "@/lib/challenges";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const Common = {
  title: z.string().max(200),
  description: z.string().max(2000),
  deliverable: z.enum(["VIDEO", "STORY"]),
  deliveryDays: z.number().int(),
};
const Create = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("GOAL"),
    ...Common,
    goalCents: z.number().int().positive(),
    deadline: z.coerce.date(),
    reward: z.enum(["BACKERS", "EVERYONE"]),
  }),
  z.object({
    kind: z.literal("REQUEST"),
    ...Common,
    creatorUsername: z.string().min(1).max(40),
    offerCents: z.number().int().positive(),
  }),
  z.object({
    kind: z.literal("OPEN_CALL"),
    ...Common,
    offerCents: z.number().int().positive(),
    deadline: z.coerce.date(),
  }),
]);

/** Lists challenges by tab: open, calls (open calls), done (delivered), inbox (yours to answer or deliver), mine, backing. */
export async function GET(req: NextRequest) {
  try {
    const tab = z.enum(CHALLENGE_TABS).catch("open").parse(req.nextUrl.searchParams.get("tab"));
    const user = PERSONAL_CHALLENGE_TABS.includes(tab) ? await getCurrentUser() : null;
    if (PERSONAL_CHALLENGE_TABS.includes(tab) && !user) return jsonError(401, t("challenge.errors.SIGN_IN"));
    return NextResponse.json({
      success: true,
      tab,
      items: await listChallenges(tab, user?.id ?? null),
    });
  } catch (error) {
    return errorResponse(error, "challenges/list");
  }
}

/**
 * Opens a challenge: a creator's goal (pledges until the deadline, all or nothing), a request to one creator (the
 * sender's offer is held at once; the creator has three days to answer) or an open call for any creator (the author's
 * pot is held; creators apply and the author picks one).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    if (!(await checkRateLimit(`challenge-create:${user.id}`, 20, 60 * 60)).success) return jsonError(429, t("challenge.errors.TOO_MANY"));
    const input = Create.parse(await req.json());
    const targetCreatorId = input.kind === "REQUEST" ? await creatorIdByUsername(input.creatorUsername) : null;
    if (input.kind === "REQUEST" && !targetCreatorId) return jsonError(404, t("challenge.errors.NOT_A_CREATOR"));
    const { challenge, balanceCents } = await createChallenge({
      ...input,
      authorId: user.id,
      targetCreatorId,
      goalCents: input.kind === "GOAL" ? input.goalCents : null,
      offerCents: input.kind === "GOAL" ? null : input.offerCents,
      deadline: input.kind === "REQUEST" ? null : input.deadline,
      reward: input.kind === "GOAL" ? input.reward : "BACKERS",
    });
    after(() => notifyCreated(challenge));
    return NextResponse.json({ success: true, challengeId: challenge.id, balanceCents }, { status: 201 });
  } catch (error) {
    const known = challengeHttpError(error);
    if (known) return jsonError(known.status, known.message, known.extra);
    return errorResponse(error, "challenges/create");
  }
}
