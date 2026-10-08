"use client";

import { useCallback, useEffect, useState } from "react";

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
 * The signed-in account's notifications: loaded once, kept live by the realtime stream (new ones arrive at once),
 * refreshed every minute as a fallback (several app instances do not share the stream).
 */
export function useNotifications(enabled: boolean) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);

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
    const stream = new EventSource("/api/conversations/stream");
    stream.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as { type?: string; notification?: NotificationItem };
        if (event.type === "notification" && event.notification) {
          setItems((all) => [event.notification!, ...all.filter((n) => n.id !== event.notification!.id)]);
          setUnread((n) => n + 1);
        }
      } catch {
        /* heartbeat or malformed */
      }
    };
    return () => {
      clearInterval(poll);
      stream.close();
    };
  }, [enabled, load]);

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
