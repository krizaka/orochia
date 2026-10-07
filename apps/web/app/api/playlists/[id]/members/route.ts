import { audienceRoutes } from "@/lib/audience-routes";

export const dynamic = "force-dynamic";

const routes = audienceRoutes("collection");

/** Who your invited-only collection is open to: invited accounts and attached lists (owner only). */
export const GET = routes.GET;

/** Invites an account (`username`) or attaches one of your lists (`listId`) to your collection (owner only, idempotent). */
export const POST = routes.POST;

/** Withdraws an invitation (`?userId=`) or detaches a list (`?listId=`) (owner only). */
export const DELETE = routes.DELETE;
