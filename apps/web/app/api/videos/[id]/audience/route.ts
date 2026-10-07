import { audienceRoutes } from "@/lib/audience-routes";

export const dynamic = "force-dynamic";

const routes = audienceRoutes("video");

/** Who your invited-only video is open to: invited accounts and attached lists (creator only). */
export const GET = routes.GET;

/** Invites an account (`username`, notified by e-mail) or attaches one of your lists (`listId`) to your video (creator only, idempotent). */
export const POST = routes.POST;

/** Withdraws an invitation (`?userId=`) or detaches a list (`?listId=`) (creator only). */
export const DELETE = routes.DELETE;
