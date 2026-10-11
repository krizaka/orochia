"use client";

import { useCallback, useEffect, useState } from "react";

import { useLiveEvents } from "@/lib/realtime-client";

/** The account's unread messages (the badge on Messages): loaded once, then moved by the stream's `unread` events. */
export function useUnreadMessages(enabled: boolean): number {
  const [total, setTotal] = useState(0);
  const load = useCallback(async () => {
    const res = await fetch("/api/conversations/unread", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setTotal(((await res.json()) as { total: number }).total);
  }, []);
  useEffect(() => {
    if (enabled) void load();
    else setTotal(0);
  }, [enabled, load]);
  useLiveEvents(enabled, (event) => {
    if (event.type === "unread" && typeof event.total === "number") setTotal(event.total);
    if (event.type === "connected" && event.reconnect) void load();
  });
  return total;
}
