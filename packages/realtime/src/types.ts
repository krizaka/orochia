/**
 * The realtime contract. Application code knows these interfaces only; which adapter carries them (memory, PostgreSQL
 * LISTEN/NOTIFY, Redis / Valkey) is a deployment choice (`createBus`).
 */

export type Unsubscribe = () => void;

/** What a connection says about its person: in front of the screen, or connected but idle / hidden. */
export type ConnectionState = "online" | "away";
/** A person's presence: the best state among their connections, `offline` when none is left. */
export type PresenceState = ConnectionState | "offline";

export interface PresenceInfo {
  state: PresenceState;
  /** Epoch ms the person was last connected (null: never seen by this store — the caller may know better). */
  lastSeenAt: number | null;
}

/** A person's presence changed (the store announces each change once, whichever instance noticed it). */
export interface PresenceChange {
  userId: string;
  state: PresenceState;
  at: number;
}

export interface PresenceOptions {
  /** How long a connection counts without a new beat (ms). Beats come at a third of it. */
  ttlMs: number;
  /** How long a closed connection still counts (ms): a reconnection inside it changes nothing (no offline flicker). */
  graceMs: number;
}

/**
 * Who is connected, kept by heartbeat and time-to-live — never a database write per beat. Every method answers the
 * change it caused, if any, so the caller publishes it once.
 */
export interface PresenceStore {
  /** A connection is (still) there, in this state: opens it or refreshes its TTL. */
  beat(userId: string, connectionId: string, state: ConnectionState, now?: number): Promise<PresenceChange | null>;
  /** A connection closed: it lingers `graceMs`, then the person may be offline — `settle` tells. */
  leave(userId: string, connectionId: string, now?: number): Promise<PresenceChange | null>;
  /** Re-evaluates a person after expiries (the caller runs it once the grace has passed). */
  settle(userId: string, now?: number): Promise<PresenceChange | null>;
  /** The presence of these people (absent from the store: offline, last seen unknown). */
  get(userIds: string[], now?: number): Promise<Map<string, PresenceInfo>>;
  /**
   * Changes this instance discovers on its own rather than as the answer to a call (another instance's report that
   * makes a person offline). Announce them like the others. Returns the unsubscribe function.
   */
  onChange(listener: (change: PresenceChange) => void): Unsubscribe;
}

export type BusKind = "memory" | "postgres" | "redis";

/**
 * The bus: events by channel to every subscriber of every instance, and presence. Best-effort by design — a publish
 * never throws; durable facts (messages) live in the database and are replayed from it, never from the bus.
 */
export interface RealtimeBus {
  readonly kind: BusKind;
  /** True while events published by other instances reach this one (always true for `memory`). */
  readonly connected: boolean;
  readonly presence: PresenceStore;
  publish(channel: string, event: unknown): Promise<void>;
  subscribe(channel: string, handler: (event: unknown) => void): Unsubscribe;
  close(): Promise<void>;
}

export const DEFAULT_PRESENCE: PresenceOptions = { ttlMs: 45_000, graceMs: 10_000 };

/** The rank of a state: a person is as present as their most present connection. */
export const rank = (state: PresenceState) => (state === "online" ? 2 : state === "away" ? 1 : 0);
