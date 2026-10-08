import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, users } from "@orochia/db";
import { and, eq, isNull } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { checkDateOfBirth } from "@/lib/profile";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Records your date of birth (18+) when the account has none yet; once set it cannot be changed here. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const { dateOfBirth } = z.object({ dateOfBirth: z.string().trim() }).parse(await req.json());
    const [row] = await db
      .update(users)
      .set({ dateOfBirth: checkDateOfBirth(dateOfBirth), updatedAt: new Date() })
      .where(and(eq(users.id, user.id), isNull(users.dateOfBirth)))
      .returning({ id: users.id });
    if (!row) return jsonError(409, "Your date of birth is already recorded. Contact support to correct it.");
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "me/birth-date");
  }
}
