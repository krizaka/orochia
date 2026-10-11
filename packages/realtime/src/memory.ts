import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";

import { ReplicatedPresence } from "./presence";
import type { PresenceOptions, RealtimeBus } from "./types";

/**
 * One process, no network: events go from publisher to subscribers through an EventEmitter. For tests and a single
 * instance without a database; it is also the local fan-out every other adapter uses inside an instance.
 */
export function localEmitter(): EventEmitter {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  return emitter;
}

/** Hands an event to a channel's local subscribers; a failing subscriber never stops the others. */
export function emitSafely(emitter: EventEmitter, channel: string, event: unknown) {
  for (const listener of emitter.listeners(channel)) {
    try {
      (listener as (e: unknown) => void)(event);
    } catch (error) {
      console.warn(`[realtime] a subscriber of ${channel} failed`, (error as Error).message);
    }
  }
}

export function memoryBus(options: Partial<PresenceOptions> = {}): RealtimeBus {
  const emitter = localEmitter();
  const presence = new ReplicatedPresence({ instanceId: randomUUID(), ...options });
  return {
    kind: "memory",
    connected: true,
    presence,
    async publish(channel, event) {
      emitSafely(emitter, channel, event);
    },
    subscribe(channel, handler) {
      emitter.on(channel, handler);
      return () => void emitter.off(channel, handler);
    },
    async close() {
      emitter.removeAllListeners();
    },
  };
}
