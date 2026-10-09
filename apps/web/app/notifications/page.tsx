"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCheck, Settings } from "lucide-react";
import { Button, buttonVariants, Spinner } from "@/components/ui";
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
        <Link href="/auth/login?next=/notifications" className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white">
          {t("nav.signIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-black text-fg">{t("notifications.title")}</h1>
          {unread > 0 && <p className="text-xs text-fg-secondary">{t("notifications.unread", { count: unread })}</p>}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Button variant="outline" size="sm" shape="rounded" onClick={() => void markRead("all")} className="rounded-xl">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden /> {t("notifications.markAll")}
            </Button>
          )}
          <Link href="/dashboard?tab=settings#settings-notifications" aria-label={t("notifications.settings")} title={t("notifications.settings")} className={buttonVariants({ variant: "outline", size: "icon", shape: "rounded", className: "h-8 w-8 rounded-xl text-fg-secondary" })}>
            <Settings className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
      <div className="glass-panel rounded-3xl p-2">
        {!loaded ? (
          <div className="flex justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : all.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-fg-muted">{t("notifications.empty")}</p>
        ) : (
          all.map((n) => <NotificationRow key={n.id} n={n} onOpen={() => !n.readAt && void markRead([n.id])} />)
        )}
      </div>
      {loaded && all.length >= 25 && more && (
        <Button variant="ghost" size="sm" shape="rounded" onClick={() => void loadOlder()} loading={loadingMore} className="mx-auto mt-4 flex rounded-xl text-accent hover:bg-accent/10 hover:text-accent">
          {t("notifications.loadMore")}
        </Button>
      )}
    </div>
  );
}
