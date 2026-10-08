import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { listNotifications, markNotificationsRead } from "@/lib/notifications";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Your notifications, newest first, 25 at a time (`before` = an ISO date to page back), with the unread count. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const before = z.string().datetime().optional().safeParse(req.nextUrl.searchParams.get("before") ?? undefined);
    return NextResponse.json({ success: true, ...(await listNotifications(user.id, before.success && before.data ? new Date(before.data) : undefined)) });
  } catch (error) {
    return errorResponse(error, "me/notifications/get");
  }
}

/** Marks notifications read: the ones listed, or all of them. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["MEMBER", "CREATOR", "ADMIN"]);
    const body = z.union([z.object({ all: z.literal(true) }), z.object({ ids: z.array(z.string().uuid()).min(1).max(100) })]).parse(await req.json());
    await markNotificationsRead(user.id, "all" in body ? "all" : body.ids);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/notifications/read");
  }
}
