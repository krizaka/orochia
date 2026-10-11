import { DEFAULT_PRESENCE, rank, type ConnectionState, type PresenceChange, type PresenceInfo, type PresenceOptions, type PresenceState, type PresenceStore } from "./types";

/**
 * Presence in this process's memory, optionally replicated between instances through the bus that carries it
 * (PostgreSQL LISTEN/NOTIFY). Each instance keeps its own connections (heartbeat + TTL) and tells the others its
 * *local* view of a person when it changes, plus a snapshot of everyone connected to it at a regular pace; a person's
 * presence is the best of the local view and the views of the other instances still heard from.
 *
 * Changes are announced once: by the instance where the event happened (a remote report only updates what this
 * instance believes was announced). An instance that dies stops refreshing its snapshot: its people fade out after
 * `snapshotTtlMs` (no event — clients refresh presence on a slow poll as a fallback).
 */

/** What an instance tells the others: one person's local state (`d` = delta), or a page of its connected people. */
export type PresenceReplica =
  | { t: "d"; i: string; u: string; s: PresenceState; at: number }
  | { t: "s"; i: string; at: number; users: [string, ConnectionState][] };

interface Conn {
  state: ConnectionState;
  expiresAt: number;
}

export interface ReplicatedPresenceOptions extends Partial<PresenceOptions> {
  /** This instance's id (random per process). */
  instanceId: string;
  /** Sends a replica to the other instances (absent: a single instance). */
  broadcast?: (replica: PresenceReplica) => void;
  /** How long another instance's snapshot counts (ms) — about 2.5 snapshot intervals. */
  snapshotTtlMs?: number;
  /** The most people a snapshot page carries (a PostgreSQL NOTIFY payload stays under 8 KB). */
  snapshotPage?: number;
}

const MAX_LAST_SEEN = 100_000;

export class ReplicatedPresence implements PresenceStore {
  readonly options: PresenceOptions;
  private readonly local = new Map<string, Map<string, Conn>>();
  private readonly remote = new Map<string, Map<string, { state: ConnectionState; expiresAt: number }>>();
  private readonly announced = new Map<string, PresenceState>();
  /** The local view last told to the other instances. */
  private readonly told = new Map<string, PresenceState>();
  private readonly lastSeen = new Map<string, number>();
  private readonly listeners = new Set<(change: PresenceChange) => void>();
  private readonly snapshotTtlMs: number;
  private readonly snapshotPage: number;

  constructor(private readonly config: ReplicatedPresenceOptions) {
    this.options = { ...DEFAULT_PRESENCE, ...config };
    this.snapshotTtlMs = config.snapshotTtlMs ?? 75_000;
    this.snapshotPage = config.snapshotPage ?? 150;
  }

  /** This instance's view of one person: the best of its live connections (expired ones are dropped). */
  private localState(userId: string, now: number): PresenceState {
    const conns = this.local.get(userId);
    if (!conns) return "offline";
    let best: PresenceState = "offline";
    for (const [id, conn] of conns) {
      if (conn.expiresAt <= now) conns.delete(id);
      else if (rank(conn.state) > rank(best)) best = conn.state;
    }
    if (conns.size === 0) this.local.delete(userId);
    return best;
  }

  private remoteState(userId: string, now: number): PresenceState {
    const views = this.remote.get(userId);
    if (!views) return "offline";
    let best: PresenceState = "offline";
    for (const [instance, view] of views) {
      if (view.expiresAt <= now) views.delete(instance);
      else if (rank(view.state) > rank(best)) best = view.state;
    }
    if (views.size === 0) this.remote.delete(userId);
    return best;
  }

  private state(userId: string, now: number): PresenceState {
    const a = this.localState(userId, now);
    const b = this.remoteState(userId, now);
    return rank(a) >= rank(b) ? a : b;
  }

  /**
   * Compares with what was announced; records and returns the change. A change caused by another instance's report is
   * returned only when it is an offline the reporter may not have seen (both instances lost the person at once): the
   * instance with the greater id announces it — at most a duplicate, never a person left online forever.
   */
  private evaluate(userId: string, now: number, own: boolean, reporter?: string): PresenceChange | null {
    const local = this.localState(userId, now);
    if ((this.told.get(userId) ?? "offline") !== local) {
      if (local === "offline") this.told.delete(userId);
      else this.told.set(userId, local);
      this.config.broadcast?.({ t: "d", i: this.config.instanceId, u: userId, s: local, at: now });
    }
    const next = this.state(userId, now);
    const previous = this.announced.get(userId) ?? "offline";
    if (next === "offline") {
      this.announced.delete(userId);
      if (previous !== "offline") this.see(userId, now);
    } else {
      this.announced.set(userId, next);
      this.see(userId, now);
    }
    if (next === previous) return null;
    if (own) return { userId, state: next, at: now };
    if (next === "offline" && reporter !== undefined && this.config.instanceId > reporter) return { userId, state: next, at: now };
    return null;
  }

  private see(userId: string, at: number) {
    if (this.lastSeen.size >= MAX_LAST_SEEN && !this.lastSeen.has(userId)) this.lastSeen.clear();
    this.lastSeen.set(userId, at);
  }

  async beat(userId: string, connectionId: string, state: ConnectionState, now = Date.now()) {
    let conns = this.local.get(userId);
    if (!conns) this.local.set(userId, (conns = new Map()));
    conns.set(connectionId, { state, expiresAt: now + this.options.ttlMs });
    return this.evaluate(userId, now, true);
  }

  async leave(userId: string, connectionId: string, now = Date.now()) {
    const conn = this.local.get(userId)?.get(connectionId);
    // The connection lingers for the grace period: a reconnection inside it changes nothing.
    if (conn) conn.expiresAt = Math.min(conn.expiresAt, now + this.options.graceMs);
    return this.evaluate(userId, now, true);
  }

  async settle(userId: string, now = Date.now()) {
    return this.evaluate(userId, now, true);
  }

  async get(userIds: string[], now = Date.now()) {
    const out = new Map<string, PresenceInfo>();
    for (const id of userIds) {
      const state = this.state(id, now);
      out.set(id, { state, lastSeenAt: state === "offline" ? (this.lastSeen.get(id) ?? null) : now });
    }
    return out;
  }

  onChange(listener: (change: PresenceChange) => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  /** Another instance spoke (ignored when it is this one). */
  receive(replica: PresenceReplica, now = Date.now()) {
    if (replica.i === this.config.instanceId) return;
    const expiresAt = now + this.snapshotTtlMs;
    const apply = (userId: string, state: PresenceState) => {
      let views = this.remote.get(userId);
      if (state === "offline") {
        views?.delete(replica.i);
        if (views && views.size === 0) this.remote.delete(userId);
      } else {
        if (!views) this.remote.set(userId, (views = new Map()));
        views.set(replica.i, { state, expiresAt });
      }
      const change = this.evaluate(userId, now, false, replica.i);
      if (change) for (const listener of this.listeners) listener(change);
    };
    if (replica.t === "d") apply(replica.u, replica.s);
    else for (const [userId, state] of replica.users) apply(userId, state);
  }

  /** This instance's connected people, in pages small enough for the bus (sent at a regular pace). */
  snapshot(now = Date.now()): PresenceReplica[] {
    const users: [string, ConnectionState][] = [];
    for (const userId of [...this.local.keys()]) {
      const state = this.localState(userId, now);
      if (state !== "offline") users.push([userId, state]);
    }
    const pages: PresenceReplica[] = [];
    for (let i = 0; i < users.length; i += this.snapshotPage) {
      pages.push({ t: "s", i: this.config.instanceId, at: now, users: users.slice(i, i + this.snapshotPage) });
    }
    return pages;
  }

  /** How many connections this instance holds (metrics, tests). */
  get connections(): number {
    let n = 0;
    for (const conns of this.local.values()) n += conns.size;
    return n;
  }
}
