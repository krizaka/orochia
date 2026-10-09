import { NextRequest } from "next/server";
import { challengeIdOr404, challengeTopic } from "@/lib/challenges";
import { sseResponse } from "@/lib/realtime";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Server-Sent Events of a challenge: each pledge (amount, alias, new total) and every change of state. */
export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const id = challengeIdOr404((await props.params).id);
    return sseResponse([challengeTopic(id)], {
      status: "connected",
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error, "challenges/stream");
  }
}
