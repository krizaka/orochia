import { randomUUID } from "node:crypto";

import { emitSafely, localEmitter } from "./memory";
import { ReplicatedPresence, type PresenceReplica } from "./presence";
import type { PresenceOptions, RealtimeBus } from "./types";

/** The two PostgreSQL primitives the adapter needs — injected, so this package depends on no database client. */
export interface PostgresChannel {
  /** `select pg_notify(channel, payload)` — delivered to every LISTENer at commit. */
  notify(channel: string, payload: string): Promise<void>;
  /** One dedicated LISTEN connection that reconnects by itself. */
  listen(channel: string, onMessage: (payload: string) => void): { readonly connected: boolean; close(): Promise<void> };
}

export interface PostgresBusOptions extends Partial<PresenceOptions> {
  db: PostgresChannel;
  /** The NOTIFY channel (one for every topic). */
  channel?: string;
  /** How often this instance tells the others who is connected to it (ms). */
  snapshotIntervalMs?: number;
}

/** PostgreSQL's limit is 8000 bytes per payload; the envelope stays under it. */
export const NOTIFY_LIMIT = 7900;
const PRESENCE_TOPIC = "__rt.presence";

/**
 * PostgreSQL LISTEN/NOTIFY: every instance LISTENs on one channel and hands each event to its local subscribers —
 * no broker, the database the app already has does the fan-out. Every instance receives every event (fine for a
 * handful of instances; past that, Redis subscribes per channel). Presence is kept in each instance's memory and
 * replicated over the same channel (deltas + a snapshot every `snapshotIntervalMs`). While the LISTEN connection is
 * down, events still reach the other instances (NOTIFY needs no LISTEN) and this instance's subscribers directly.
 */
export function postgresBus(options: PostgresBusOptions): RealtimeBus {
  const channel = options.channel ?? "orochia_events";
  const emitter = localEmitter();
  const instanceId = randomUUID();
  const intervalMs = options.snapshotIntervalMs ?? 30_000;

  const send = async (topic: string, event: unknown) => {
    const payload = JSON.stringify({ topic, event });
    if (Buffer.byteLength(payload) > NOTIFY_LIMIT) throw new Error(`payload too large for ${topic}`);
    await options.db.notify(channel, payload);
  };

  const presence = new ReplicatedPresence({
    ...options,
    instanceId,
    snapshotTtlMs: Math.round(intervalMs * 2.5),
    broadcast: (replica) => void send(PRESENCE_TOPIC, replica).catch(() => undefined),
  });

  const listener = options.db.listen(channel, (payload) => {
    try {
      const { topic, event } = JSON.parse(payload) as { topic: string; event: unknown };
      if (topic === PRESENCE_TOPIC) presence.receive(event as PresenceReplica);
      else emitSafely(emitter, topic, event);
    } catch {
      /* not ours */
    }
  });

  const timer = setInterval(() => {
    for (const page of presence.snapshot()) void send(PRESENCE_TOPIC, page).catch(() => undefined);
  }, intervalMs);
  timer.unref?.();

  return {
    kind: "postgres",
    get connected() {
      return listener.connected;
    },
    presence,
    async publish(topic, event) {
      // NOTIFY needs no LISTEN: publish even while this instance's own listener is (re)connecting — the others hear it
      // — and hand it to the local subscribers directly in that case, since the echo will not come back.
      const hearsEcho = listener.connected;
      try {
        await send(topic, event);
        if (!hearsEcho) emitSafely(emitter, topic, event);
      } catch (error) {
        console.warn(`[realtime] publish ${topic} failed, delivered locally`, (error as Error).message);
        emitSafely(emitter, topic, event);
      }
    },
    subscribe(topic, handler) {
      emitter.on(topic, handler);
      return () => void emitter.off(topic, handler);
    },
    async close() {
      clearInterval(timer);
      emitter.removeAllListeners();
      await listener.close();
    },
  };
}
