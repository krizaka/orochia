"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useLiveEvents } from "@/lib/realtime-client";

export interface NotificationItem {
  id: string;
  event: string;
  text: string;
  path: string;
  actorAvatar?: string | null;
  createdAt: string;
  readAt: string | null;
}

/**
 * The signed-in account's notifications: loaded once, kept live by the account's stream (lib/realtime-client.ts — one
 * connection per tab, shared with Messages), reloaded after a reconnection and every minute as a fallback.
 */
export function useNotifications(enabled: boolean, { onLive }: { onLive?: (n: NotificationItem) => void } = {}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  /** Called for each notification that arrives live while the page is open (the bell shows it as a toast). */
  const live = useRef(onLive);
  useEffect(() => {
    live.current = onLive;
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/me/notifications", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { items: NotificationItem[]; unread: number };
    setItems(data.items);
    setUnread(data.unread);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const poll = setInterval(() => void load(), 60_000);
    return () => clearInterval(poll);
  }, [enabled, load]);

  useLiveEvents(enabled, (event) => {
    if (event.type === "connected" && event.reconnect) void load();
    const notification = event.type === "notification" ? (event.notification as NotificationItem | undefined) : undefined;
    if (!notification) return;
    setItems((all) => [notification, ...all.filter((n) => n.id !== notification.id)]);
    setUnread((n) => n + 1);
    live.current?.(notification);
  });

  const markRead = useCallback(async (ids: string[] | "all") => {
    const now = new Date().toISOString();
    setItems((all) => all.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, readAt: n.readAt ?? now } : n)));
    setUnread((n) => (ids === "all" ? 0 : Math.max(0, n - ids.length)));
    await fetch("/api/me/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ids === "all" ? { all: true } : { ids }) }).catch(() => undefined);
  }, []);

  return { items, unread, loaded, markRead, reload: load };
}

const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" }) : null;
export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!rtf) return "";
  if (s < 60) return rtf.format(-Math.round(s), "second");
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  if (s < 604800) return rtf.format(-Math.round(s / 86400), "day");
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
