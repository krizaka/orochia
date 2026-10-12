import { db, users } from "@orochia/db";
import { eq } from "drizzle-orm";

import { getCurrentUser, type SessionUser } from "./auth";
import { type ViewerState, viewerStateOf } from "./creator-journey";

export interface Viewer {
  user: SessionUser | null;
  state: ViewerState;
}

/**
 * The signed-in account and its state for calls to action (lib/creator-journey.ts). The session only says who it is:
 * the role, the 2257 verification and a suspension are read from the database, so a member who just opened a creator
 * space — or a creator an operator just approved — sees the right next step at once. Never throws.
 */
export async function getViewer(): Promise<Viewer> {
  const user = await getCurrentUser();
  if (!user) return { user: null, state: "anonymous" };
  const account = await db
    .select({ role: users.role, isVerified: users.isVerified, suspendedAt: users.suspendedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)
    .then(([row]) => row ?? null)
    .catch((error: unknown) => {
      // The database did not answer: the session still says who this is — a signed-in person never becomes a visitor
      // (and never gets the sign-up form). The pages that act (upload, apply) read the account again.
      console.error("[viewer] account unavailable:", error);
      return undefined;
    });
  if (account === undefined) return { user, state: viewerStateOf({ role: user.role, isVerified: true }) };
  if (!account) return { user: null, state: "anonymous" };
  return { user: { ...user, role: account.role }, state: viewerStateOf({ role: account.role, isVerified: account.isVerified, suspended: Boolean(account.suspendedAt) }) };
}
