import { db, profiles, users } from "@orochia/db";
import { eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { presenceCircle, presenceOf } from "@/lib/presence";

export const dynamic = "force-dynamic";

/** The people of the account's circle who are online or away right now ("Online now" in Messages). */
export async function GET() {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const presence = await presenceOf(await presenceCircle(user.id));
    const ids = Object.keys(presence).filter((id) => presence[id].state !== "offline");
    const people = ids.length
      ? await db
          .select({ id: users.id, username: users.username, displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`, avatarUrl: profiles.avatarUrl })
          .from(users)
          .leftJoin(profiles, eq(profiles.userId, users.id))
          .where(inArray(users.id, ids))
      : [];
    const online = people
      .map((p) => ({ ...p, presence: presence[p.id] }))
      .sort((a, b) => (a.presence.state === b.presence.state ? a.displayName.localeCompare(b.displayName) : a.presence.state === "online" ? -1 : 1));
    return NextResponse.json({ success: true, online });
  } catch (error) {
    return errorResponse(error, "presence/online");
  }
}
