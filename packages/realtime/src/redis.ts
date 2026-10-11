import { Redis, type RedisOptions } from "ioredis";

import { emitSafely, localEmitter } from "./memory";
import { DEFAULT_PRESENCE, rank, type ConnectionState, type PresenceChange, type PresenceInfo, type PresenceOptions, type PresenceState, type PresenceStore, type RealtimeBus } from "./types";

export interface RedisBusOptions extends Partial<PresenceOptions> {
  /** `redis://` or `rediss://` (Redis or Valkey — DigitalOcean Managed Caching speaks the same protocol). */
  url: string;
  /** Prefix of every key and channel (several products can share one server). */
  prefix?: string;
  /** How long "last seen" is kept (seconds). */
  lastSeenTtlSeconds?: number;
  redisOptions?: RedisOptions;
}

/**
 * One person's presence, atomically: apply the operation, drop expired connections, compare the best remaining state
 * with the announced one. Returns the new state when it changed (announce it), nil otherwise.
 * KEYS: the person's hash (`c:<connection>` = "<state>|<expiresAt>", `a` = announced), their last-seen key.
 */
const UPDATE = `
local key, seen = KEYS[1], KEYS[2]
local op, conn, st = ARGV[1], ARGV[2], ARGV[3]
local now, ttl, grace, keep = tonumber(ARGV[4]), tonumber(ARGV[5]), tonumber(ARGV[6]), tonumber(ARGV[7])
if op == "beat" then
  redis.call("HSET", key, "c:" .. conn, st .. "|" .. (now + ttl))
elseif op == "leave" then
  local cur = redis.call("HGET", key, "c:" .. conn)
  if cur then
    local s, exp = string.match(cur, "^(%a+)|(%d+)$")
    redis.call("HSET", key, "c:" .. conn, s .. "|" .. math.min(tonumber(exp), now + grace))
  end
end
local best = 0
local all = redis.call("HGETALL", key)
for i = 1, #all, 2 do
  local f, v = all[i], all[i + 1]
  if string.sub(f, 1, 2) == "c:" then
    local s, exp = string.match(v, "^(%a+)|(%d+)$")
    if tonumber(exp) <= now then
      redis.call("HDEL", key, f)
    else
      local r = 1
      if s == "online" then r = 2 end
      if r > best then best = r end
    end
  end
end
local nextState = "offline"
if best == 2 then nextState = "online" elseif best == 1 then nextState = "away" end
local prev = redis.call("HGET", key, "a") or "offline"
if nextState == "offline" then
  if prev ~= "offline" then redis.call("SET", seen, now, "EX", keep) end
  redis.call("DEL", key)
else
  redis.call("HSET", key, "a", nextState)
  redis.call("PEXPIRE", key, ttl * 2)
  redis.call("SET", seen, now, "EX", keep)
end
if nextState == prev then return false end
return nextState
`;

/** Presence in Redis / Valkey: shared by every instance, one atomic script per beat, keys that expire by themselves. */
export class RedisPresence implements PresenceStore {
  readonly options: PresenceOptions;
  private readonly keep: number;

  constructor(
    private readonly redis: Redis,
    private readonly prefix: string,
    options: Partial<PresenceOptions> & { lastSeenTtlSeconds?: number } = {},
  ) {
    this.options = { ...DEFAULT_PRESENCE, ...options };
    this.keep = options.lastSeenTtlSeconds ?? 90 * 24 * 3600;
  }

  // The {user} hash tag keeps both keys in one slot (Redis Cluster).
  private keys(userId: string) {
    return [`${this.prefix}p:{${userId}}`, `${this.prefix}s:{${userId}}`];
  }

  private async run(op: "beat" | "leave" | "settle", userId: string, connectionId: string, state: ConnectionState, now: number) {
    const [key, seen] = this.keys(userId);
    const result = (await this.redis.eval(UPDATE, 2, key, seen, op, connectionId, state, now, this.options.ttlMs, this.options.graceMs, this.keep)) as string | null;
    return result ? { userId, state: result as PresenceState, at: now } : null;
  }

  beat(userId: string, connectionId: string, state: ConnectionState, now = Date.now()) {
    return this.run("beat", userId, connectionId, state, now);
  }

  leave(userId: string, connectionId: string, now = Date.now()) {
    return this.run("leave", userId, connectionId, "online", now);
  }

  settle(userId: string, now = Date.now()) {
    return this.run("settle", userId, "", "online", now);
  }

  /** Every change is the answer of the call that caused it: nothing is discovered later. */
  onChange(): () => void {
    return () => undefined;
  }

  async get(userIds: string[], now = Date.now()) {
    const out = new Map<string, PresenceInfo>();
    if (userIds.length === 0) return out;
    const pipeline = this.redis.pipeline();
    for (const id of userIds) {
      const [key, seen] = this.keys(id);
      pipeline.hgetall(key);
      pipeline.get(seen);
    }
    const replies = (await pipeline.exec()) ?? [];
    userIds.forEach((id, i) => {
      const hash = (replies[i * 2]?.[1] ?? {}) as Record<string, string>;
      const seen = replies[i * 2 + 1]?.[1] as string | null;
      let state: PresenceState = "offline";
      for (const [field, value] of Object.entries(hash)) {
        if (!field.startsWith("c:")) continue;
        const [s, exp] = value.split("|");
        if (Number(exp) > now && rank(s as ConnectionState) > rank(state)) state = s as ConnectionState;
      }
      out.set(id, { state, lastSeenAt: state === "offline" ? (seen ? Number(seen) : null) : now });
    });
    return out;
  }
}

/**
 * Redis / Valkey pub/sub: each instance subscribes only to the channels its open streams need (one subscription per
 * channel, counted), so an event crosses the network only to the instances that have someone listening — the choice
 * for several instances and many streams. Presence lives in Redis (`RedisPresence`).
 */
export function redisBus(options: RedisBusOptions): RealtimeBus {
  const prefix = options.prefix ?? "orochia:rt:";
  const base: RedisOptions = { maxRetriesPerRequest: 2, enableOfflineQueue: true, ...options.redisOptions };
  const pub = new Redis(options.url, base);
  const sub = new Redis(options.url, { ...base, maxRetriesPerRequest: null });
  const emitter = localEmitter();
  const counts = new Map<string, number>();
  for (const client of [pub, sub]) client.on("error", (error) => console.warn(`[realtime] redis: ${error.message}`));

  sub.on("message", (channel: string, message: string) => {
    if (!channel.startsWith(prefix)) return;
    try {
      emitSafely(emitter, channel.slice(prefix.length), JSON.parse(message));
    } catch {
      /* not ours */
    }
  });

  return {
    kind: "redis",
    get connected() {
      return sub.status === "ready" && pub.status === "ready";
    },
    presence: new RedisPresence(pub, prefix, options),
    async publish(channel, event) {
      try {
        await pub.publish(prefix + channel, JSON.stringify(event));
      } catch (error) {
        console.warn(`[realtime] publish ${channel} failed, delivered locally`, (error as Error).message);
        emitSafely(emitter, channel, event);
      }
    },
    subscribe(channel, handler) {
      emitter.on(channel, handler);
      const n = (counts.get(channel) ?? 0) + 1;
      counts.set(channel, n);
      if (n === 1) void sub.subscribe(prefix + channel).catch((error: Error) => console.warn(`[realtime] subscribe ${channel}: ${error.message}`));
      return () => {
        emitter.off(channel, handler);
        const left = (counts.get(channel) ?? 1) - 1;
        if (left > 0) return void counts.set(channel, left);
        counts.delete(channel);
        void sub.unsubscribe(prefix + channel).catch(() => undefined);
      };
    },
    async close() {
      emitter.removeAllListeners();
      await Promise.allSettled([pub.quit(), sub.quit()]);
    },
  };
}
