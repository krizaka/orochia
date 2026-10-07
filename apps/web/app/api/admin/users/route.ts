import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, users, profiles } from "@orochia/db";
import { and, desc, eq, ilike, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const Query = z.object({
  role: z.enum(["ADMIN", "CREATOR", "MEMBER"]).optional(),
  suspended: z.enum(["true", "false"]).optional(),
  q: z.string().trim().max(100).optional(),
});

/** Every account (filter by `?role=`, `?suspended=`, `?q=`): role, verification and suspension state. */
export async function GET(req: NextRequest) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const { role, suspended, q } = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
    const filters: (SQL | undefined)[] = [];
    if (role) filters.push(eq(users.role, role));
    if (suspended === "true") filters.push(isNotNull(users.suspendedAt));
    if (suspended === "false") filters.push(sql`${users.suspendedAt} is null`);
    if (q) filters.push(or(ilike(users.username, `%${q}%`), ilike(users.email, `%${q}%`)));
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
        isVerified: users.isVerified,
        isAgeVerified: users.isAgeVerified,
        suspendedAt: users.suspendedAt,
        suspensionReason: users.suspensionReason,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(500);
    return NextResponse.json({ success: true, users: rows });
  } catch (error) {
    return errorResponse(error, "admin/users");
  }
}
