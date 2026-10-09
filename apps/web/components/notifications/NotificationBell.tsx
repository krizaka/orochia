"use client";

import { Bell, CheckCheck, Settings } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { Button, buttonVariants, cn, IconButton, Popover, Skeleton, toast } from "@/components/ui";
import { t } from "@/lib/i18n";

import { NotificationRow } from "./NotificationRow";
import { NotificationToast } from "./NotificationToast";
import { useNotifications } from "./useNotifications";

/**
 * The bell in the top bar: unread count, live, and a toast (@krizaka/ui/toast, the `Toaster` of the layout) for each
 * notification that arrives while the page is open. On a computer it opens the latest notifications (a popover); on a phone it is a
 * link to /notifications (a page, so its address can be shared and reloaded).
 */
export function NotificationBell() {
  const { items, unread, loaded, markRead } = useNotifications(true, {
    // What just happened, as it happens: a toast for each notification that arrives while the page is open.
    onLive: (n) =>
      toast.custom(
        (id) => (
          <NotificationToast
            n={n}
            onOpen={() => {
              toast.dismiss(id);
              void markRead([n.id]);
            }}
            onDismiss={() => toast.dismiss(id)}
          />
        ),
        { id: n.id, duration: 7000 },
      ),
  });
  const [open, setOpen] = useState(false);

  const badge = unread > 0 && (
    <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-2 px-1 text-[10px] font-bold text-on-accent ring-2 ring-surface-0">
      {unread > 99 ? "99+" : unread}
    </span>
  );
  const bellClass = "relative h-9 w-9 bg-surface-2/80 text-fg-secondary hover:border-accent/50 hover:text-fg";
  const label = unread ? `${t("notifications.title")} — ${t("notifications.unread", { count: unread })}` : t("notifications.title");

  return (
    <div className="relative">
      <Link href="/notifications" aria-label={label} className={buttonVariants({ variant: "outline", size: "icon", shape: "pill", className: cn(bellClass, "md:hidden") })}>
        <Bell className="h-4 w-4" />
        {badge}
      </Link>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <IconButton variant="outline" shape="pill" label={label} className={cn(bellClass, "hidden md:flex")}>
            <Bell className="h-4 w-4" aria-hidden />
            {badge}
          </IconButton>
        </Popover.Trigger>
        <Popover.Content align="end" aria-label={t("notifications.title")} className="w-[380px] overflow-hidden rounded-2xl bg-surface-1/95 p-0 shadow-2xl backdrop-blur-2xl">
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
        </Popover.Content>
      </Popover.Root>
    </div>
  );
}
