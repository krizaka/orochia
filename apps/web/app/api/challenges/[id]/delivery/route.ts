import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { deliverChallenge } from "@orochia/payments";
import { requireUserWithRole } from "@/lib/auth";
import { announceDelivered, challengeHttpError, challengeIdOr404, deliveryOptions } from "@/lib/challenges";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Deliver = z
  .object({
    videoId: z.string().uuid().optional(),
    storyId: z.string().uuid().optional(),
  })
  .refine((d) => Boolean(d.videoId) !== Boolean(d.storyId));

/** What the creator can deliver: their ready videos not used elsewhere, or the stories posted since they committed. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR"]);
    const id = challengeIdOr404((await props.params).id);
    return NextResponse.json({
      success: true,
      ...(await deliveryOptions(id, user.id)),
    });
  } catch (error) {
    return errorResponse(error, "challenges/delivery-options");
  }
}

/** The creator delivers a video or a story: the backers' pledges are paid and they can watch it. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUserWithRole(["CREATOR"]);
    const id = challengeIdOr404((await props.params).id);
    const input = Deliver.parse(await req.json());
    const { challenge, paidBackers } = await deliverChallenge({
      challengeId: id,
      creatorId: user.id,
      ...input,
    });
    after(() => announceDelivered(challenge, paidBackers));
    return NextResponse.json({ success: true, status: challenge.status });
  } catch (error) {
    const known = challengeHttpError(error);
    if (known) return jsonError(known.status, known.message, known.extra);
    return errorResponse(error, "challenges/deliver");
  }
}
