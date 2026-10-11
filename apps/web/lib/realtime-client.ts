"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * The browser's side of the account's live stream (`/api/conversations/stream`): ONE EventSource per tab, shared by
 * every component that listens (the bell, the messages badge, the inbox) and closed when the last one leaves.
 *
 * - Reconnection: EventSource retries by itself and sends `Last-Event-ID`, so missed messages are replayed by the
 *   server. When it gives up (a 401, a server error), this module reopens it with a growing delay and `?after=<seq>`.
 * - Activity: hidden tab or 3 minutes without input → `away`; back → `online` (`POST /api/presence`, this connection
 *   only). The server keeps the heartbeat; nothing is sent while nothing changes.
 */

export type LiveStatus = "idle" | "connecting" | "open" | "reconnecting";

export type LiveEvent = { type?: string; [key: string]: unknown };
type Listener = (event: LiveEvent) => void;

const IDLE_MS = 3 * 60_000;

class LiveStream {
  private source: EventSource | null = null;
  private refs = 0;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<() => void>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 1000;
  private lastSeq: number | null = null;
  private activity: "online" | "away" = "online";
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private detachActivity: (() => void) | null = null;
  private everOpened = false;
  connectionId: string | null = null;
  status: LiveStatus = "idle";

  private setStatus(status: LiveStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((l) => l());
  }

  private emit(event: LiveEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("[live] listener failed", error);
      }
    }
  }

  private open() {
    const url = this.lastSeq !== null ? `/api/conversations/stream?after=${this.lastSeq}` : "/api/conversations/stream";
    const source = new EventSource(url);
    this.source = source;
    this.setStatus(this.status === "idle" ? "connecting" : "reconnecting");
    source.addEventListener("connected", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { connectionId: string; resumed: boolean };
      this.connectionId = data.connectionId;
      this.retryDelay = 1000;
      this.setStatus("open");
      // A reconnection: what changed meanwhile (receipts, unread counts) is reloaded by the listeners.
      this.emit({ type: "connected", resumed: data.resumed, reconnect: this.everOpened });
      this.everOpened = true;
      if (this.activity === "away") void this.report();
    });
    source.onmessage = (e) => {
      const seq = /^m(\d+)$/.exec(e.lastEventId)?.[1];
      if (seq) this.lastSeq = Math.max(this.lastSeq ?? 0, Number(seq));
      try {
        this.emit(JSON.parse(e.data) as LiveEvent);
      } catch {
        /* not JSON */
      }
    };
    source.onerror = () => {
      if (source.readyState === EventSource.CONNECTING) return this.setStatus("reconnecting");
      // Closed for good (an HTTP error): reopen later, from the last message seen.
      source.close();
      this.source = null;
      this.setStatus("reconnecting");
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (this.refs > 0) this.open();
      }, this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
    };
  }

  private report() {
    if (!this.connectionId) return Promise.resolve();
    return fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: this.connectionId, state: this.activity }),
      keepalive: true,
    }).catch(() => undefined);
  }

  private setActivity(state: "online" | "away") {
    if (this.activity === state) return;
    this.activity = state;
    void this.report();
  }

  private watchActivity() {
    const bump = () => {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      if (document.visibilityState === "visible") this.setActivity("online");
      this.idleTimer = setTimeout(() => this.setActivity("away"), IDLE_MS);
    };
    const visibility = () => (document.visibilityState === "hidden" ? this.setActivity("away") : bump());
    const events = ["pointerdown", "keydown", "scroll", "focus"] as const;
    events.forEach((name) => window.addEventListener(name, bump, { passive: true }));
    document.addEventListener("visibilitychange", visibility);
    bump();
    this.detachActivity = () => {
      events.forEach((name) => window.removeEventListener(name, bump));
      document.removeEventListener("visibilitychange", visibility);
      if (this.idleTimer) clearTimeout(this.idleTimer);
    };
  }

  acquire(): () => void {
    this.refs += 1;
    if (this.refs === 1) {
      this.open();
      this.watchActivity();
    }
    return () => {
      this.refs -= 1;
      if (this.refs > 0) return;
      this.source?.close();
      this.source = null;
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.detachActivity?.();
      this.connectionId = null;
      this.everOpened = false;
      this.lastSeq = null;
      this.setStatus("idle");
    };
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  onStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => void this.statusListeners.delete(listener);
  }
}

const holder = globalThis as unknown as { __orochiaLive?: LiveStream };
export function liveStream(): LiveStream {
  if (!holder.__orochiaLive) holder.__orochiaLive = new LiveStream();
  return holder.__orochiaLive;
}

/** Listens to the account's live events while `enabled` (the stream opens with the first listener). */
export function useLiveEvents(enabled: boolean, handler: Listener) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!enabled) return;
    const stream = liveStream();
    const off = stream.on((event) => ref.current(event));
    const release = stream.acquire();
    return () => {
      off();
      release();
    };
  }, [enabled]);
}

/** The stream's state, for a discreet "reconnecting…" line. */
export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(
    (notify) => liveStream().onStatus(notify),
    () => liveStream().status,
    () => "idle",
  );
}
