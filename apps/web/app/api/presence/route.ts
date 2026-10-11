import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { presenceFor } from "@/lib/presence";
import { limitAction } from "@/lib/rate-limit";
import { publish } from "@/lib/realtime";

export const dynamic = "force-dynamic";

const Ids = z.string().uuid().array().min(1).max(100);

/**
 * The presence (online · away · offline with the time last seen) of up to 100 accounts — only those the rules let the
 * account see (lib/presence-rules.ts); the others are absent from the answer.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    await limitAction("presence-read", req, user.id, { perUser: [120, 60] });
    const ids = Ids.parse((req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean));
    return NextResponse.json({ success: true, presence: await presenceFor(user.id, ids) });
  } catch (error) {
    return errorResponse(error, "presence");
  }
}

const Activity = z.object({ connectionId: z.string().uuid(), state: z.enum(["online", "away"]) });

/**
 * The app's activity on one of its streams: `away` when the page is hidden or idle, `online` when the person is back.
 * Relayed to the stream through the account's topic (whichever instance holds it), never stored.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    await limitAction("presence-activity", req, user.id, { perUser: [60, 60] });
    const { connectionId, state } = Activity.parse(await req.json());
    await publish(`user:${user.id}`, { type: "conn_state", connectionId, state });
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "presence");
  }
}
