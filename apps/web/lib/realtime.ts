import { createBus, eventStream, type RealtimeBus, type SseFrame } from "@krizaka/realtime";
import { redisBus } from "@krizaka/realtime/redis";
import { listenChannel, notifyChannel } from "@orochia/db";

import { realtimeConfig } from "./env";

/**
 * The realtime door: everything that is pushed live goes through here. The transport is `@krizaka/realtime`'s
 * `RealtimeBus` — PostgreSQL LISTEN/NOTIFY by default, Redis / Valkey with `REALTIME_BUS=redis` — chosen by
 * configuration; the code that publishes and subscribes never knows which.
 *
 * Topics: `user:<id>` (one account's messages, receipts, typing, notifications), `presence:<id>` (one account's
 * presence, delivered only to those allowed to see it — lib/presence.ts), `auction:<id>`, `challenge:<id>`.
 * Payloads are small facts (≤ 8 KB), never documents: what must not be lost lives in the database and is replayed
 * from it (lib/chat-stream.ts).
 */

/** The PostgreSQL NOTIFY channel of Orochia (every instance LISTENs on it — packages/db/src/listen.ts). */
export const CHANNEL = "orochia_events";

// One bus per process, kept across hot reloads in development.
const holder = globalThis as unknown as { __orochiaBus?: RealtimeBus };

export function realtimeBus(): RealtimeBus {
  if (!holder.__orochiaBus) {
    const config = realtimeConfig();
    holder.__orochiaBus = createBus({
      kind: config.kind,
      postgres: { listen: listenChannel, notify: notifyChannel },
      channel: CHANNEL,
      redisBus,
      redisUrl: config.redisUrl,
      prefix: config.prefix,
    });
  }
  return holder.__orochiaBus;
}

/** Subscribes to a topic on this instance; returns the unsubscribe function. */
export function subscribe<T = unknown>(topic: string, callback: (event: T) => void): () => void {
  return realtimeBus().subscribe(topic, callback as (event: unknown) => void);
}

/** Publishes an event to every instance's subscribers of the topic. Never throws: realtime is best-effort. */
export async function publish(topic: string, event: unknown): Promise<void> {
  try {
    await realtimeBus().publish(topic, event);
  } catch (error) {
    console.warn(`[realtime] publish ${topic} failed`, (error as Error).message);
  }
}

/** Shared by every stream: reconnect after 2 s, end after REALTIME_STREAM_MAX_SECONDS (the client comes back at once). */
export function streamTimings() {
  const { streamMaxSeconds } = realtimeConfig();
  return { retryMs: 2000, heartbeatMs: 15_000, maxLifetimeMs: streamMaxSeconds * 1000 };
}

/**
 * A Server-Sent Events response fed by one or more topics (auctions, challenges): a `connected` event, then each event
 * as a `data:` line, a heartbeat every 15 s, and the subscriptions dropped when the client goes away.
 */
export function sseResponse(topics: string[], initial?: unknown): Response {
  return eventStream({
    ...streamTimings(),
    start: ({ send }) => {
      send({ event: "connected", data: initial ?? { status: "connected" } });
      const offs = topics.map((topic) => subscribe(topic, (event) => send({ data: event })));
      return () => offs.forEach((off) => off());
    },
  });
}

export type { SseFrame };
