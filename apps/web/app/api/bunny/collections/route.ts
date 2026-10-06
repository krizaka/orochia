import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, playlists } from "@orochia/db";
import { and, desc, eq, or } from "drizzle-orm";
import { getCurrentUser, requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Public collections, plus the signed-in creator's own private ones. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const creatorId = z.string().uuid().safeParse(new URL(req.url).searchParams.get("creatorId"));
    const visible = user
      ? or(eq(playlists.isPrivate, false), eq(playlists.creatorId, user.id))
      : eq(playlists.isPrivate, false);
    const collections = await db
      .select()
      .from(playlists)
      .where(creatorId.success ? and(visible, eq(playlists.creatorId, creatorId.data)) : visible)
      .orderBy(desc(playlists.createdAt))
      .limit(100);
    return NextResponse.json({ success: true, collections });
  } catch (error) {
    return errorResponse(error, "collections/get");
  }
}

const CollectionSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().default(""),
  isPrivate: z.boolean().optional().default(false),
});

/** Creates a collection owned by the signed-in creator. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const input = CollectionSchema.parse(await req.json());
    const [collection] = await db
      .insert(playlists)
      .values({ creatorId: user.id, title: input.title, description: input.description, isPrivate: input.isPrivate })
      .returning();
    return NextResponse.json({ success: true, collection }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "collections/post");
  }
}
