"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Settings } from "lucide-react";
import { NotificationRow } from "./NotificationRow";
import { NotificationToasts } from "./NotificationToasts";
import { useNotifications } from "./useNotifications";
import { t } from "@/lib/i18n";
import { Button, buttonVariants, cn, IconButton, Skeleton } from "@/components/ui";

/**
 * The bell in the top bar: unread count, live, and a toast for each notification that arrives while the page is open. On a computer it opens the latest notifications; on a phone it is a
 * link to /notifications (a page, so its address can be shared and reloaded).
 */
export function NotificationBell() {
  const { items, unread, loaded, markRead, fresh, dismiss } = useNotifications(true);
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
    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-2 px-1 text-[10px] font-bold text-on-accent ring-2 ring-surface-0">
      {unread > 99 ? "99+" : unread}
    </span>
  );
  const bellClass = "relative h-9 w-9 bg-surface-2/80 text-fg-secondary hover:border-accent/50 hover:text-fg";
  const label = unread ? `${t("notifications.title")} — ${t("notifications.unread", { count: unread })}` : t("notifications.title");

  return (
    <div ref={box} className="relative">
      <Link href="/notifications" aria-label={label} className={buttonVariants({ variant: "outline", size: "icon", shape: "pill", className: cn(bellClass, "md:hidden") })}>
        <Bell className="h-4 w-4" />
        {badge}
      </Link>
      <IconButton variant="outline" shape="pill" label={label} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cn(bellClass, "hidden md:flex")}>
        <Bell className="h-4 w-4" aria-hidden />
        {badge}
      </IconButton>

      {open && (
        <div role="dialog" aria-label={t("notifications.title")} className="kz-pop absolute right-0 mt-2 w-[380px] overflow-hidden rounded-2xl border border-border-default bg-surface-1/95 shadow-2xl shadow-black/50 backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <h2 className="text-sm font-bold text-fg">{t("notifications.title")}</h2>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <Button variant="ghost" size="sm" shape="rounded" onClick={() => void markRead("all")} className="h-7 gap-1 px-2 text-[11px] text-accent hover:bg-accent/10 hover:text-accent">
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden /> {t("notifications.markAll")}
                </Button>
              )}
              <Link href="/dashboard?tab=settings#settings-notifications" onClick={() => setOpen(false)} aria-label={t("notifications.settings")} title={t("notifications.settings")} className={buttonVariants({ variant: "ghost", size: "icon", shape: "rounded", className: "h-7 w-7" })}>
                <Settings className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {!loaded ? (
              Array.from({ length: 4 }, (_, i) => <Skeleton key={i} shape="rect" className="m-1 h-14 w-auto rounded-xl" />)
            ) : items.length === 0 ? (
              <p className="px-6 py-10 text-center text-xs text-fg-muted">{t("notifications.empty")}</p>
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
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-border-subtle py-2.5 text-center text-xs font-semibold text-accent hover:bg-surface-2">
            {t("notifications.seeAll")}
          </Link>
        </div>
      )}
      <NotificationToasts
        items={fresh}
        onDismiss={dismiss}
        onOpen={(n) => {
          dismiss(n.id);
          void markRead([n.id]);
        }}
      />
    </div>
  );
}
