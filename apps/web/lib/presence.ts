import { db, users } from "@orochia/db";
import { type ConnectionState, DEFAULT_PRESENCE, type PresenceChange, type PresenceState } from "@krizaka/realtime";
import { eq, inArray, sql } from "drizzle-orm";

import { PRESENCE_CIRCLE_LIMIT } from "./presence-rules";
import { publish, realtimeBus } from "./realtime";

/**
 * Presence: online · away · offline ("seen 5 min ago"). Kept by the realtime bus's presence store — a heartbeat on each
 * open stream refreshes a TTL in memory (or Redis); the database is written once per visit (`users.last_seen_at`,
 * when the last app closes), never per beat. Who sees whom is lib/presence-rules.ts; `presenceCircle` runs that rule
 * in SQL. Changes are published on `presence:<id>`, which only the streams of the person's circle follow.
 */

export const presenceTopic = (userId: string) => `presence:${userId}`;

export interface PresenceView {
  state: PresenceState;
  /** ISO time last seen (offline only; null when unknown). */
  lastSeenAt: string | null;
}

/** The event a circle receives. */
export interface PresenceEvent extends PresenceView {
  type: "presence";
  userId: string;
}

/**
 * The people whose presence `viewerId` may see — lib/presence-rules.ts in SQL: active accounts, no block either way,
 * both showing their presence, and an accepted contact, an exchange (both wrote) or an approved follow of a creator.
 * Most recent relationships first, at most PRESENCE_CIRCLE_LIMIT.
 */
export async function presenceCircle(viewerId: string, limit = PRESENCE_CIRCLE_LIMIT): Promise<string[]> {
  const result = await db.execute<{ id: string }>(sql`
    with me as (
      select coalesce(p.show_presence, true) as shows
        from users u left join profiles p on p.user_id = u.id
       where u.id = ${viewerId} and u.suspended_at is null and u.email_verified_at is not null
    ),
    candidates as (
      select case when c.requester_id = ${viewerId} then c.addressee_id else c.requester_id end as id, c.updated_at as at
        from contacts c
       where c.status = 'ACCEPTED' and (c.requester_id = ${viewerId} or c.addressee_id = ${viewerId})
      union all
      select case when cv.participant1_id = ${viewerId} then cv.participant2_id else cv.participant1_id end, cv.last_message_at
        from conversations cv
       where (cv.participant1_id = ${viewerId} or cv.participant2_id = ${viewerId})
         and exists (select 1 from direct_messages m where m.conversation_id = cv.id and m.sender_id = cv.participant1_id)
         and exists (select 1 from direct_messages m where m.conversation_id = cv.id and m.sender_id = cv.participant2_id)
      union all
      select f.creator_id, coalesce(f.decided_at, f.created_at)
        from follows f join users cu on cu.id = f.creator_id
       where f.follower_id = ${viewerId} and f.status = 'APPROVED' and cu.role in ('CREATOR', 'ADMIN')
    )
    select c.id
      from candidates c
      join users u on u.id = c.id and u.suspended_at is null and u.email_verified_at is not null
      left join profiles p on p.user_id = u.id
     where coalesce((select shows from me), false)
       and coalesce(p.show_presence, true)
       and c.id <> ${viewerId}
       and not exists (
         select 1 from contacts k
          where k.status = 'BLOCKED'
            and ((k.requester_id = ${viewerId} and k.addressee_id = c.id) or (k.requester_id = c.id and k.addressee_id = ${viewerId}))
       )
       and not exists (
         select 1 from blocked_users b
          where (b.blocker_id = ${viewerId} and b.blocked_id = c.id) or (b.blocker_id = c.id and b.blocked_id = ${viewerId})
       )
     group by c.id
     order by max(c.at) desc
     limit ${limit}`);
  return result.rows.map((r) => r.id);
}

/** The presence of `ids` as `viewerId` may see it: people outside the circle are simply absent from the answer. */
export async function presenceFor(viewerId: string, ids: string[]): Promise<Record<string, PresenceView>> {
  if (ids.length === 0) return {};
  const circle = new Set(await presenceCircle(viewerId));
  const visible = [...new Set(ids)].filter((id) => circle.has(id));
  return presenceOf(visible);
}

/** The presence of people already known to be visible (no rule checked here). */
export async function presenceOf(ids: string[]): Promise<Record<string, PresenceView>> {
  if (ids.length === 0) return {};
  const live = await realtimeBus().presence.get(ids);
  const unknown = ids.filter((id) => live.get(id)?.state === "offline" && live.get(id)?.lastSeenAt == null);
  const stored = unknown.length
    ? await db.select({ id: users.id, lastSeenAt: users.lastSeenAt }).from(users).where(inArray(users.id, unknown))
    : [];
  const seen = new Map(stored.map((r) => [r.id, r.lastSeenAt]));
  const out: Record<string, PresenceView> = {};
  for (const id of ids) {
    const info = live.get(id) ?? { state: "offline" as const, lastSeenAt: null };
    const lastSeen = info.state === "offline" ? (info.lastSeenAt ? new Date(info.lastSeenAt) : (seen.get(id) ?? null)) : null;
    out[id] = { state: info.state, lastSeenAt: lastSeen ? lastSeen.toISOString() : null };
  }
  return out;
}

/** Whether the account is in front of an Orochia screen right now (an open page or app, not idle). */
export async function isOnline(userId: string): Promise<boolean> {
  return (await realtimeBus().presence.get([userId])).get(userId)?.state === "online";
}

async function showsPresence(userId: string): Promise<boolean> {
  const result = await db.execute<{ shows: boolean }>(sql`select coalesce(p.show_presence, true) as shows from users u left join profiles p on p.user_id = u.id where u.id = ${userId}`);
  return result.rows[0]?.shows ?? false;
}

/** Tells a person's circle about a change, and records "last seen" once when they leave. */
async function announce(change: PresenceChange | null) {
  if (!change) return;
  try {
    const at = new Date(change.at);
    if (change.state === "offline") await db.update(users).set({ lastSeenAt: at }).where(eq(users.id, change.userId));
    // Someone hiding their presence is never announced (their circle sees them offline, with no time).
    if (!(await showsPresence(change.userId))) return;
    const event: PresenceEvent = { type: "presence", userId: change.userId, state: change.state, lastSeenAt: change.state === "offline" ? at.toISOString() : null };
    await publish(presenceTopic(change.userId), event);
  } catch (error) {
    console.warn("[presence] announce failed", (error as Error).message);
  }
}

// Changes an instance discovers by itself (another instance's report) are announced too — once per process.
const holder = globalThis as unknown as { __orochiaPresenceWired?: boolean };
function wire() {
  if (holder.__orochiaPresenceWired) return;
  holder.__orochiaPresenceWired = true;
  realtimeBus().presence.onChange((change) => void announce(change));
}

/** A stream is open or still there (each heartbeat), in this state. */
export async function presenceBeat(userId: string, connectionId: string, state: ConnectionState) {
  wire();
  await announce(await realtimeBus().presence.beat(userId, connectionId, state));
}

/** A stream closed: after the grace period (a reconnection in between changes nothing) the person may be offline. */
export async function presenceLeave(userId: string, connectionId: string) {
  wire();
  const store = realtimeBus().presence;
  await announce(await store.leave(userId, connectionId));
  const timer = setTimeout(() => void store.settle(userId).then(announce), DEFAULT_PRESENCE.graceMs + 500);
  timer.unref?.();
}

/** A relationship changed between two accounts (contact, approved follow, exchange, block): both rebuild their circle. */
export function circleChanged(...userIds: string[]) {
  for (const id of new Set(userIds)) void publish(`user:${id}`, { type: "circle_changed" });
}

/**
 * The person hid (or showed again) their presence: their circle hears it at once — hidden reads as offline with no
 * time — and their own streams rebuild their circle (hiding yours hides everyone else's).
 */
export async function presenceSettingChanged(userId: string, shows: boolean) {
  const state = shows ? ((await realtimeBus().presence.get([userId])).get(userId)?.state ?? "offline") : "offline";
  if (!shows || state !== "offline") await publish(presenceTopic(userId), { type: "presence", userId, state, lastSeenAt: null } satisfies PresenceEvent);
  circleChanged(userId);
}
