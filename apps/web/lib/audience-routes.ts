import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "./auth";
import { attachList, audienceOf, detachList, invitePerson, uninvitePerson, type AudienceTarget } from "./audiences";
import { checkRateLimit } from "./rate-limit";
import { errorResponse, jsonError } from "./http";

/** Adds one account by username, or one of the owner's lists. */
const Add = z.union([
  z.object({ username: z.string().trim().min(1).max(51) }),
  z.object({ listId: z.string().uuid() }),
]);

type Params = { params: Promise<{ id: string }> };

/**
 * The GET / POST / DELETE handlers of an audience endpoint (`/api/videos/[id]/audience`,
 * `/api/playlists/[id]/members`): same body, same answers, owner only.
 */
export function audienceRoutes(kind: AudienceTarget) {
  const notFound = kind === "video" ? "Video not found" : "Playlist not found";
  const context = async (params: Params["params"]) => {
    const user = await requireUserWithRole(kind === "video" ? ["CREATOR", "ADMIN"] : ["MEMBER", "CREATOR", "ADMIN"]);
    const id = z.string().uuid().safeParse((await params).id);
    return { user, id: id.success ? id.data : null };
  };

  return {
    async GET(_req: NextRequest, { params }: Params) {
      try {
        const { user, id } = await context(params);
        if (!id) return jsonError(404, notFound);
        const { people, lists } = await audienceOf(kind, user.id, id);
        return NextResponse.json({ success: true, members: people, lists });
      } catch (error) {
        return errorResponse(error, `${kind}/audience/get`);
      }
    },

    async POST(req: NextRequest, { params }: Params) {
      try {
        const { user, id } = await context(params);
        if (!id) return jsonError(404, notFound);
        const limit = await checkRateLimit(`invite:${user.id}`, 120, 60 * 60);
        if (!limit.success) return jsonError(429, "Too many requests. Try again later.");
        const body = Add.parse(await req.json());
        if ("listId" in body) {
          await attachList(kind, user.id, id, body.listId);
          return NextResponse.json({ success: true }, { status: 201 });
        }
        return NextResponse.json({ success: true, member: await invitePerson(kind, user.id, id, body.username) }, { status: 201 });
      } catch (error) {
        return errorResponse(error, `${kind}/audience/post`);
      }
    },

    async DELETE(req: NextRequest, { params }: Params) {
      try {
        const { user, id } = await context(params);
        if (!id) return jsonError(404, notFound);
        const userId = z.string().uuid().safeParse(req.nextUrl.searchParams.get("userId"));
        const listId = z.string().uuid().safeParse(req.nextUrl.searchParams.get("listId"));
        if (userId.success) await uninvitePerson(kind, user.id, id, userId.data);
        else if (listId.success) await detachList(kind, user.id, id, listId.data);
        else return jsonError(404, "Member not found");
        return NextResponse.json({ success: true });
      } catch (error) {
        return errorResponse(error, `${kind}/audience/delete`);
      }
    },
  };
}
