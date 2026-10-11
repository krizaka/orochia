import { randomUUID } from "node:crypto";

import { db, directMessages } from "@orochia/db";
import { type ConnectionState, eventStream, type EventStreamControls } from "@orochia/realtime";
import { and, asc, eq, gt, gte, or, sql } from "drizzle-orm";

import { markDelivered, type MessageView,messageView } from "./messaging";
import { presenceBeat, presenceCircle, type PresenceEvent,presenceLeave, presenceOf, presenceTopic } from "./presence";
import { streamTimings, subscribe } from "./realtime";

/**
 * An account's live stream (`/api/conversations/stream`): everything on `user:<id>` (messages, receipts, typing, the
 * badge, notifications) plus the presence of the people its circle allows — over one Server-Sent Events connection,
 * web and native alike.
 *
 * - **Resume**: message events carry `id: m<seq>`; a reconnection sends `Last-Event-ID` (or `?after=<seq>` from an
 *   app that keeps its own cursor) and the messages it missed are replayed from the database before the live ones —
 *   the client drops duplicates by id. More than REPLAY_LIMIT missed: a `resync` event asks it to reload.
 * - **Presence**: the connection is a heartbeat (`online` at open, refreshed every 15 s, `away` when the app says it
 *   is hidden or idle — `POST /api/presence`); closing it starts the grace period.
 * - **Delivery**: a message handed to one of the recipient's streams is marked delivered.
 * - **Privacy**: presence events are sent only for people of the circle, rebuilt when a block or a setting changes it.
 */

export const REPLAY_LIMIT = 500;
/** Messages committed shortly before the cursor's may have been numbered earlier but committed later: replay them too. */
const REPLAY_OVERLAP = sql`interval '10 seconds'`;

/** `m<seq>` (Last-Event-ID) or a bare number (?after=) → the cursor. */
export function parseCursor(value: string | null | undefined): number | null {
  const match = value?.trim().match(/^m?(\d{1,18})$/);
  return match ? Number(match[1]) : null;
}

async function missedMessages(userId: string, cursor: number): Promise<MessageView[]> {
  const mine = or(eq(directMessages.recipientId, userId), eq(directMessages.senderId, userId));
  const rows = await db
    .select()
    .from(directMessages)
    .where(
      and(
        mine,
        or(
          gt(directMessages.seq, cursor),
          gte(directMessages.createdAt, sql`(select created_at - ${REPLAY_OVERLAP} from direct_messages where seq = ${cursor})`),
        ),
      ),
    )
    .orderBy(asc(directMessages.seq))
    .limit(REPLAY_LIMIT + 1);
  return rows.map(messageView);
}

/** Messages this process already marked delivered (one account's several streams would each try). */
const delivered = new Set<string>();
function deliverOnce(messageId: string) {
  if (delivered.has(messageId)) return;
  if (delivered.size > 5000) delivered.clear();
  delivered.add(messageId);
  void markDelivered(messageId).catch(() => undefined);
}

interface UserEvent {
  type?: string;
  message?: MessageView;
  connectionId?: string;
  state?: ConnectionState;
}

export function userStream(userId: string, options: { cursor: number | null }): Response {
  const connectionId = randomUUID();
  let state: ConnectionState = "online";

  return eventStream({
    ...streamTimings(),
    onHeartbeat: () => void presenceBeat(userId, connectionId, state),
    start: async ({ send, signal }: EventStreamControls) => {
      const offs: (() => void)[] = [];
      let replaying = options.cursor !== null;
      const held: UserEvent[] = [];

      const deliver = (event: UserEvent) => {
        if (event.type === "conn_state") {
          // Another tab or instance relayed this connection's activity (POST /api/presence).
          if (event.connectionId === connectionId && event.state && event.state !== state) {
            state = event.state;
            void presenceBeat(userId, connectionId, state);
          }
          return;
        }
        if (event.type === "circle_changed") void follow();
        if ((event.type === "new_message" || event.type === "message_sent") && event.message) {
          send({ id: `m${event.message.seq}`, data: event });
          if (event.type === "new_message" && !event.message.deliveredAt) deliverOnce(event.message.id);
          return;
        }
        send({ data: event });
      };

      // 1. The account's topic first, held while the replay runs: nothing falls between the two.
      offs.push(
        subscribe<UserEvent>(`user:${userId}`, (event) => {
          if (replaying) held.push(event);
          else deliver(event);
        }),
      );

      // 2. The presence of the circle, rebuilt when it changes (a block, a setting).
      let circle = new Set<string>();
      const presenceOffs = new Map<string, () => void>();
      const follow = async () => {
        const next = new Set(await presenceCircle(userId));
        if (signal.aborted) return;
        for (const [id, off] of presenceOffs) {
          if (next.has(id)) continue;
          off();
          presenceOffs.delete(id);
        }
        for (const id of next) {
          if (presenceOffs.has(id)) continue;
          presenceOffs.set(
            id,
            subscribe<PresenceEvent>(presenceTopic(id), (event) => {
              if (circle.has(event.userId)) send({ data: event });
            }),
          );
        }
        circle = next;
        // The whole circle once (the client replaces what it knew): who is online right now.
        send({ data: { type: "presence_snapshot", presence: await presenceOf([...next]) } });
      };
      offs.push(() => presenceOffs.forEach((off) => off()));

      send({ event: "connected", data: { connectionId, resumed: options.cursor !== null, serverNow: new Date().toISOString() } });

      // 3. The messages missed since the cursor, then what arrived meanwhile.
      if (options.cursor !== null) {
        const missed = await missedMessages(userId, options.cursor);
        if (missed.length > REPLAY_LIMIT) send({ data: { type: "resync" } });
        else for (const message of missed) deliver({ type: message.senderId === userId ? "message_sent" : "new_message", message });
        replaying = false;
        for (const event of held.splice(0)) deliver(event);
      }

      await follow();
      await presenceBeat(userId, connectionId, "online");
      return () => {
        offs.forEach((off) => off());
        void presenceLeave(userId, connectionId);
      };
    },
  });
}
