"use client";

import { CheckIcon, MessageIcon } from "@krizaka/icons";
import Link from "next/link";
import React from "react";

import { timeAgo } from "@/components/notifications/useNotifications";
import { Badge, cn, EmptyState, Skeleton } from "@/components/ui";
import { conversationPath } from "@/lib/conversation-path";
import { t } from "@/lib/i18n";

import { PresenceAvatar, presenceLabel } from "./PresenceAvatar";
import { type Conversation, type PresenceView, receiptOf } from "./types";

/** Two ticks for delivered, two in the accent for seen — the label says it for screen readers. */
export function Ticks({ receipt, className }: { receipt: "sent" | "delivered" | "read"; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center", receipt === "read" ? "text-fg-accent" : "text-fg-muted", className)} aria-hidden>
      <CheckIcon size={12} strokeWidth={2.5} />
      {receipt !== "sent" && <CheckIcon size={12} strokeWidth={2.5} className="-ml-[7px]" />}
    </span>
  );
}

/** The conversations, newest first: presence, last message (or "typing…"), its receipt, the unread count. */
export function ConversationList({
  conversations,
  loaded,
  activeId,
  myId,
  presence,
  typing,
}: {
  conversations: Conversation[];
  loaded: boolean;
  activeId: string | null;
  myId: string | null;
  presence: Record<string, PresenceView>;
  typing: Record<string, number>;
}) {
  if (!loaded) {
    return (
      <ul className="divide-y divide-border-subtle" aria-busy>
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 p-4">
            <Skeleton shape="circle" className="h-10 w-10" />
            <span className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (conversations.length === 0) {
    return <EmptyState className="p-8" icon={<MessageIcon size={28} />} title={t("inbox.none")} description={t("inbox.noneHint")} />;
  }
  return (
    <ul className="divide-y divide-border-subtle" aria-label={t("inbox.list")}>
      {conversations.map((c) => {
        const other = c.otherUser;
        const selected = c.id === activeId;
        const last = c.lastMessage;
        const mine = last?.senderId === myId;
        const isTyping = Boolean(typing[c.id]);
        const status = presenceLabel(presence[other.id]);
        const preview = isTyping
          ? t("inbox.typing")
          : last
            ? mine
              ? t("inbox.you", { text: last.content })
              : last.content
            : t("inbox.noMessages");
        return (
          <li key={c.id}>
            <Link
              href={conversationPath(c.id)}
              scroll={false}
              aria-current={selected ? "page" : undefined}
              aria-label={[other.displayName, status, c.unreadCount ? t("inbox.unreadCount", { count: c.unreadCount }) : null, preview].filter(Boolean).join(", ")}
              className={cn(
                "flex items-center gap-3 border-l-2 p-4 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                selected ? "border-accent bg-accent/10" : "border-transparent hover:bg-surface-2/60",
              )}
            >
              <PresenceAvatar src={other.avatarUrl} name={other.displayName} presence={presence[other.id]} />
              <span className="min-w-0 flex-1">
                <span className="mb-0.5 flex items-center justify-between gap-2">
                  <span className={cn("truncate text-sm text-fg", c.unreadCount ? "font-bold" : "font-semibold")}>{other.displayName}</span>
                  {last && <span className="shrink-0 text-[10px] text-fg-muted">{timeAgo(last.createdAt)}</span>}
                </span>
                <span className="flex items-center gap-1.5">
                  {mine && last && !isTyping && <Ticks receipt={receiptOf(last) as "sent" | "delivered" | "read"} />}
                  <span className={cn("truncate text-xs", isTyping ? "font-medium text-fg-accent" : c.unreadCount ? "font-semibold text-fg" : "text-fg-secondary")}>{preview}</span>
                  {c.unreadCount > 0 && (
                    <Badge tone="accent" size="sm" className="ml-auto normal-case tracking-normal">
                      {c.unreadCount > 99 ? "99+" : c.unreadCount}
                    </Badge>
                  )}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
