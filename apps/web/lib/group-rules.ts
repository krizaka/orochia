/** Group conversations — the rules as pure functions (lib/groups.ts applies them; ADR 0002). */

export const MAX_GROUP_MEMBERS = 50;
export const GROUP_TITLE_MAX = 60;
/** An invite link lives a week. */
export const INVITE_TTL_DAYS = 7;

/** Is there room for `adding` more people, counting the members already in (the owner included)? */
export function canAddMembers(current: number, adding: number): boolean {
  return adding > 0 && current + adding <= MAX_GROUP_MEMBERS;
}

export function parseGroupTitle(value: string): string | null {
  const title = value.trim().replace(/\s+/g, " ");
  return title && title.length <= GROUP_TITLE_MAX ? title : null;
}

/** The owner leaves: the group goes to the member who has been there longest; nobody left → null (the group closes). */
export function nextOwner(members: { userId: string; joinedAt: Date }[]): string | null {
  const [first] = [...members].sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
  return first?.userId ?? null;
}

export function isMuted(mutedUntil: Date | null, now: Date): boolean {
  return mutedUntil !== null && mutedUntil.getTime() > now.getTime();
}

export type InviteState = "ok" | "expired" | "revoked" | "exhausted" | "full";

export function inviteState(
  invite: { expiresAt: Date; revokedAt: Date | null; uses: number; maxUses: number },
  now: Date,
  seatsLeft: number,
): InviteState {
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt.getTime() <= now.getTime()) return "expired";
  if (invite.uses >= invite.maxUses) return "exhausted";
  if (seatsLeft <= 0) return "full";
  return "ok";
}
