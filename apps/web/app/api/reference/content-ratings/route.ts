import { NextResponse } from "next/server";
import { db, contentRatings } from "@orochia/db";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Reference content classifications and age ratings (Kids Safe, General, Teens, Mature, Adult). */
export async function GET() {
  const ratings = await db
    .select()
    .from(contentRatings)
    .orderBy(asc(contentRatings.displayOrder));
  return NextResponse.json({ success: true, ratings });
}
