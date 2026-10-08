"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Settings } from "lucide-react";
import { NotificationRow } from "./NotificationRow";
import { useNotifications } from "./useNotifications";
import { t } from "@/lib/i18n";

/**
 * The bell in the top bar: unread count, live. On a computer it opens the latest notifications; on a phone it is a
 * link to /notifications (a page, so its address can be shared and reloaded).
 */
export function NotificationBell() {
  const { items, unread, loaded, markRead } = useNotifications(true);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const badge = unread > 0 && (
    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-linear-to-r from-fuchsia-600 to-pink-600 px-1 text-[10px] font-bold text-white ring-2 ring-zinc-950 light:ring-white">
      {unread > 99 ? "99+" : unread}
    </span>
  );
  const bellClass =
    "relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-zinc-900/80 text-zinc-300 transition-colors hover:border-violet-500/50 hover:text-white light:border-black/10 light:bg-slate-100 light:text-slate-600 hover:light:text-slate-950";
  const label = unread ? `${t("notifications.title")} — ${t("notifications.unread", { count: unread })}` : t("notifications.title");

  return (
    <div ref={box} className="relative">
      <Link href="/notifications" aria-label={label} className={`${bellClass} md:hidden`}>
        <Bell className="h-4 w-4" />
        {badge}
      </Link>
      <button type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`${bellClass} hidden md:flex`}>
        <Bell className="h-4 w-4" />
        {badge}
      </button>

      {open && (
        <div role="dialog" aria-label={t("notifications.title")} className="kz-pop absolute right-0 mt-2 w-[380px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/50 backdrop-blur-2xl light:border-black/10 light:bg-white/95">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 light:border-black/5">
            <h2 className="text-sm font-bold text-white light:text-slate-900">{t("notifications.title")}</h2>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button type="button" onClick={() => void markRead("all")} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/10 light:text-violet-700">
                  <CheckCheck className="h-3.5 w-3.5" /> {t("notifications.markAll")}
                </button>
              )}
              <Link href="/dashboard?tab=settings#settings-notifications" onClick={() => setOpen(false)} aria-label={t("notifications.settings")} className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white light:text-slate-500 hover:light:bg-black/5">
                <Settings className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {!loaded ? (
              Array.from({ length: 4 }, (_, i) => <div key={i} className="m-1 h-14 animate-pulse rounded-xl bg-white/5" />)
            ) : items.length === 0 ? (
              <p className="px-6 py-10 text-center text-xs text-zinc-500">{t("notifications.empty")}</p>
            ) : (
              items.slice(0, 8).map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  compact
                  onOpen={() => {
                    setOpen(false);
                    if (!n.readAt) void markRead([n.id]);
                  }}
                />
              ))
            )}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-white/5 py-2.5 text-center text-xs font-semibold text-violet-300 hover:bg-white/5 light:border-black/5 light:text-violet-700 hover:light:bg-black/3">
            {t("notifications.seeAll")}
          </Link>
        </div>
      )}
    </div>
  );
}
