/**
 * @orochia/realtime — the realtime layer behind one interface (`RealtimeBus`: publish / subscribe by channel, and
 * presence), three adapters chosen by configuration, and Server-Sent Events. It knows nothing of Orochia: the app
 * wires it in `apps/web/lib/realtime.ts`. Candidate for a shared Krizaka brick (`@krizaka/realtime`).
 */
export * from "./types";
export { memoryBus } from "./memory";
export { postgresBus, NOTIFY_LIMIT, type PostgresChannel, type PostgresBusOptions } from "./postgres";
export { redisBus, RedisPresence, type RedisBusOptions } from "./redis";
export { ReplicatedPresence, type PresenceReplica } from "./presence";
export { eventStream, sseFrame, type EventStreamControls, type EventStreamOptions, type SseFrame } from "./sse";

import { memoryBus } from "./memory";
import { postgresBus, type PostgresChannel } from "./postgres";
import { redisBus } from "./redis";
import type { BusKind, PresenceOptions, RealtimeBus } from "./types";

export interface BusConfig extends Partial<PresenceOptions> {
  kind: BusKind;
  /** Required by `postgres`. */
  postgres?: PostgresChannel;
  /** Required by `redis`. */
  redisUrl?: string;
  prefix?: string;
}

/** The bus a deployment asked for — refuses a configuration that cannot work rather than falling back silently. */
export function createBus(config: BusConfig): RealtimeBus {
  if (config.kind === "memory") return memoryBus(config);
  if (config.kind === "postgres") {
    if (!config.postgres) throw new Error("the postgres realtime bus needs a PostgreSQL channel");
    return postgresBus({ ...config, db: config.postgres });
  }
  if (config.kind === "redis") {
    if (!config.redisUrl) throw new Error("REALTIME_BUS=redis needs REDIS_URL");
    return redisBus({ ...config, url: config.redisUrl });
  }
  throw new Error(`unknown realtime bus "${String(config.kind)}" (memory, postgres or redis)`);
}

/** Reads `REALTIME_BUS` (default `postgres`). */
export function busKind(value: string | undefined): BusKind {
  const kind = (value?.trim().toLowerCase() || "postgres") as BusKind;
  if (kind !== "memory" && kind !== "postgres" && kind !== "redis") throw new Error(`REALTIME_BUS must be memory, postgres or redis, not "${value}"`);
  return kind;
}
