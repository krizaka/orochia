import { db, users, profiles, contacts, follows } from "@orochia/db";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { HttpError } from "./http";
import { after } from "next/server";
import { notifyContactRequest, notifyFollow } from "./notifications";

/**
 * The social graph: follows (a creator approves who follows them — APPROVED_FOLLOWERS_ONLY videos)
 * and mutual contacts (CONTACTS_ONLY videos). Every rule that decides access lives here or in
 * lib/access.ts; routes only authenticate and validate.
 */

export type FollowState = "PENDING" | "APPROVED" | null;
export interface ContactState {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED";
  /** "outgoing" when the viewer sent the request. */
  direction: "outgoing" | "incoming";
}
export interface Relationship {
  follow: FollowState;
  contact: ContactState | null;
}

/** An active (not suspended) account by username, or a 404. */
export async function activeAccount(username: string) {
  const [row] = await db
    .select({ id: users.id, role: users.role, username: users.username })
    .from(users)
    .where(and(eq(users.username, username.toLowerCase()), isNull(users.suspendedAt)))
    .limit(1);
  if (!row) throw new HttpError(404, "Account not found");
  return row;
}

/** How `viewerId` relates to `otherId` (follow of a creator, contact in either direction). */
export async function relationship(viewerId: string, otherId: string): Promise<Relationship> {
  const [follow] = await db
    .select({ status: follows.status })
    .from(follows)
    .where(and(eq(follows.followerId, viewerId), eq(follows.creatorId, otherId)))
    .limit(1);
  const [contact] = await db
    .select()
    .from(contacts)
    .where(
      or(
        and(eq(contacts.requesterId, viewerId), eq(contacts.addresseeId, otherId)),
        and(eq(contacts.requesterId, otherId), eq(contacts.addresseeId, viewerId)),
      ),
    )
    .limit(1);
  return {
    follow: follow?.status ?? null,
    contact: contact
      ? { id: contact.id, status: contact.status, direction: contact.requesterId === viewerId ? "outgoing" : "incoming" }
      : null,
  };
}

/** Follows a creator. Idempotent: following twice keeps the existing state. */
export async function follow(viewerId: string, creatorUsername: string): Promise<FollowState> {
  const creator = await activeAccount(creatorUsername);
  if (creator.role !== "CREATOR") throw new HttpError(400, "Only creators can be followed");
  if (creator.id === viewerId) throw new HttpError(400, "You cannot follow yourself");
  const created = await db.insert(follows).values({ followerId: viewerId, creatorId: creator.id }).onConflictDoNothing().returning({ status: follows.status });
  const state = (await relationship(viewerId, creator.id)).follow;
  if (created.length > 0) after(() => notifyFollow(creator.id, viewerId, state === "PENDING"));
  return state;
}

export async function unfollow(viewerId: string, creatorUsername: string): Promise<void> {
  const creator = await activeAccount(creatorUsername);
  await db.delete(follows).where(and(eq(follows.followerId, viewerId), eq(follows.creatorId, creator.id)));
}

/** The creator approves or removes one of their followers. */
export async function decideFollower(creatorId: string, followId: string, action: "approve" | "remove"): Promise<void> {
  const where = and(eq(follows.id, followId), eq(follows.creatorId, creatorId));
  const rows =
    action === "approve"
      ? await db.update(follows).set({ status: "APPROVED", decidedAt: new Date() }).where(where).returning({ id: follows.id })
      : await db.delete(follows).where(where).returning({ id: follows.id });
  if (rows.length === 0) throw new HttpError(404, "Follower not found");
}

/**
 * Sends a contact request. If the other person already asked, the two requests meet and the
 * contact is accepted. A blocked pair stays blocked.
 */
export async function requestContact(viewerId: string, username: string): Promise<ContactState> {
  const other = await activeAccount(username);
  if (other.id === viewerId) throw new HttpError(400, "You cannot add yourself");
  const existing = (await relationship(viewerId, other.id)).contact;
  if (existing?.status === "BLOCKED") throw new HttpError(403, "This contact is not available");
  if (existing?.direction === "incoming" && existing.status === "PENDING") {
    await db.update(contacts).set({ status: "ACCEPTED", updatedAt: new Date() }).where(eq(contacts.id, existing.id));
    return { ...existing, status: "ACCEPTED" };
  }
  if (existing && existing.status !== "REJECTED") return existing;
  if (existing) await db.delete(contacts).where(eq(contacts.id, existing.id));
  const [row] = await db.insert(contacts).values({ requesterId: viewerId, addresseeId: other.id }).returning();
  after(() => notifyContactRequest(other.id, viewerId));
  return { id: row.id, status: row.status, direction: "outgoing" };
}

/** Accept / reject (addressee only) or block (either side) a contact. */
export async function decideContact(viewerId: string, contactId: string, action: "accept" | "reject" | "block"): Promise<void> {
  const [row] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!row || (row.requesterId !== viewerId && row.addresseeId !== viewerId)) throw new HttpError(404, "Contact not found");
  if (action !== "block" && row.addresseeId !== viewerId) throw new HttpError(403, "Only the addressee can answer a request");
  if (action !== "block" && row.status !== "PENDING") throw new HttpError(409, "This request was already answered");
  const status = action === "accept" ? "ACCEPTED" : action === "reject" ? "REJECTED" : "BLOCKED";
  await db.update(contacts).set({ status, updatedAt: new Date() }).where(eq(contacts.id, contactId));
}

/** Either side removes a contact (or withdraws a request). A block can only be lifted by deleting it. */
export async function removeContact(viewerId: string, contactId: string): Promise<void> {
  const rows = await db
    .delete(contacts)
    .where(and(eq(contacts.id, contactId), or(eq(contacts.requesterId, viewerId), eq(contacts.addresseeId, viewerId))))
    .returning({ id: contacts.id });
  if (rows.length === 0) throw new HttpError(404, "Contact not found");
}

export interface NetworkPerson {
  id: string; // the follow or contact row id
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  since: Date;
}

const person = {
  userId: users.id,
  username: users.username,
  displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
  avatarUrl: profiles.avatarUrl,
};

/** Everything the network tab shows: followers (creators), following, contacts and requests. */
export async function network(viewerId: string) {
  const followers = await db
    .select({ id: follows.id, ...person, status: follows.status, since: follows.createdAt })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.followerId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(follows.creatorId, viewerId))
    .orderBy(desc(follows.createdAt));
  const following = await db
    .select({ id: follows.id, ...person, status: follows.status, since: follows.createdAt })
    .from(follows)
    .innerJoin(users, eq(users.id, follows.creatorId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(follows.followerId, viewerId))
    .orderBy(desc(follows.createdAt));
  const other = sql`case when ${contacts.requesterId} = ${viewerId} then ${contacts.addresseeId} else ${contacts.requesterId} end`;
  const contactRows = await db
    .select({
      id: contacts.id,
      ...person,
      status: contacts.status,
      since: contacts.updatedAt,
      outgoing: sql<boolean>`${contacts.requesterId} = ${viewerId}`,
    })
    .from(contacts)
    .innerJoin(users, sql`${users.id} = ${other}`)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(or(eq(contacts.requesterId, viewerId), eq(contacts.addresseeId, viewerId)))
    .orderBy(desc(contacts.updatedAt));
  return {
    followers: followers as NetworkPerson[],
    following: following as NetworkPerson[],
    contacts: contactRows.filter((c) => c.status === "ACCEPTED") as NetworkPerson[],
    incoming: contactRows.filter((c) => c.status === "PENDING" && !c.outgoing) as NetworkPerson[],
    outgoing: contactRows.filter((c) => c.status === "PENDING" && c.outgoing) as NetworkPerson[],
  };
}
