"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCheck, Loader2, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { type NotificationItem, useNotifications } from "@/components/notifications/useNotifications";
import { t } from "@/lib/i18n";

/** Every notification of the account, newest first, live; older ones on demand. */
export default function NotificationsPage() {
  const { user } = useAuth();
  const { items, unread, loaded, markRead } = useNotifications(Boolean(user));
  const [older, setOlder] = useState<NotificationItem[]>([]);
  const [more, setMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const all = [...items, ...older.filter((o) => !items.some((n) => n.id === o.id))];

  const loadOlder = async () => {
    const last = all[all.length - 1];
    if (!last) return;
    setLoadingMore(true);
    const res = await fetch(`/api/me/notifications?before=${encodeURIComponent(last.createdAt)}`, { cache: "no-store" });
    const data = res.ok ? ((await res.json()) as { items: NotificationItem[] }) : { items: [] };
    setOlder((o) => [...o, ...data.items]);
    setMore(data.items.length === 25);
    setLoadingMore(false);
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <Link href="/auth/login?next=/notifications" className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white">
          {t("nav.signIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black text-white light:text-slate-900">{t("notifications.title")}</h1>
          {unread > 0 && <p className="text-xs text-zinc-400 light:text-slate-500">{t("notifications.unread", { count: unread })}</p>}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button type="button" onClick={() => void markRead("all")} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-violet-500/60 light:border-black/10 light:text-slate-700">
              <CheckCheck className="h-3.5 w-3.5" /> {t("notifications.markAll")}
            </button>
          )}
          <Link href="/dashboard?tab=settings#settings-notifications" aria-label={t("notifications.settings")} className="rounded-xl border border-white/10 p-2 text-zinc-300 hover:border-violet-500/60 light:border-black/10 light:text-slate-600">
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="glass-panel rounded-3xl p-2">
        {!loaded ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          </div>
        ) : all.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-zinc-500">{t("notifications.empty")}</p>
        ) : (
          all.map((n) => <NotificationRow key={n.id} n={n} onOpen={() => !n.readAt && void markRead([n.id])} />)
        )}
      </div>
      {loaded && all.length >= 25 && more && (
        <button type="button" onClick={() => void loadOlder()} disabled={loadingMore} className="mx-auto mt-4 block rounded-xl px-4 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-500/10 light:text-violet-700">
          {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : t("notifications.loadMore")}
        </button>
      )}
    </div>
  );
}
