"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { NotificationRow } from "./NotificationRow";
import type { NotificationItem } from "./useNotifications";
import { t } from "@/lib/i18n";
import { IconButton } from "@/components/ui";

const TOAST_MS = 7000;

function Toast({ n, onDismiss, onOpen }: { n: NotificationItem; onDismiss: () => void; onOpen: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  return (
    <div role="status" className="kz-pop pointer-events-auto relative w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border-default bg-surface-1/95 pr-8 shadow-2xl shadow-black/50 backdrop-blur-2xl">
      <NotificationRow n={n} compact onOpen={onOpen} />
      <IconButton onClick={onDismiss} shape="rounded" label={t("notifications.dismiss")} className="absolute right-2 top-2 h-6 w-6">
        <X className="h-3.5 w-3.5" aria-hidden />
      </IconButton>
      <span aria-hidden className="nt-bar absolute inset-x-0 bottom-0 h-0.5 origin-left bg-linear-to-r from-accent via-accent-2 to-accent-2" />
      <style>{STYLES}</style>
    </div>
  );
}

/**
 * What just happened, as it happens: a notification that arrives while the page is open (a follower, a tip, a bid…)
 * slides in at the bottom right for a few seconds — a tap opens it. The bell keeps the full list.
 */
export function NotificationToasts({ items, onDismiss, onOpen }: { items: NotificationItem[]; onDismiss: (id: string) => void; onOpen: (n: NotificationItem) => void }) {
  if (items.length === 0) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-24 right-4 z-[60] flex flex-col gap-2 md:bottom-6">
      {items.map((n) => (
        <Toast key={n.id} n={n} onDismiss={() => onDismiss(n.id)} onOpen={() => onOpen(n)} />
      ))}
    </div>
  );
}

const STYLES = `
  .nt-bar { animation: nt-bar ${TOAST_MS}ms linear forwards; }
  @keyframes nt-bar { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  @media (prefers-reduced-motion: reduce) { .nt-bar { animation: none; } }
`;
