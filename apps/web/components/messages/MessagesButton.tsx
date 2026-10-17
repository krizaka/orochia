"use client";

import { MessageIcon } from "@krizaka/icons";
import Link from "next/link";
import { usePathname } from "@/lib/use-pathname";
import React from "react";

import { buttonVariants, cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";

import { useUnreadMessages } from "./useUnreadMessages";

/** Messages in the top bar, next to the bell, on every width: the unread count moves live. */
export function MessagesButton() {
  const { t } = useI18n();
  const unread = useUnreadMessages(true);
  const active = usePathname().startsWith("/messages");
  const label = unread ? `${t("nav.messages")} — ${t("inbox.unreadCount", { count: unread })}` : t("nav.messages");
  return (
    <Link
      href="/messages"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={buttonVariants({
        variant: "outline",
        size: "icon",
        shape: "pill",
        className: cn("relative h-9 w-9 bg-surface-2/80 text-fg-secondary hover:border-accent/50 hover:text-fg", active && "border-accent/60 text-fg"),
      })}
    >
      <MessageIcon size={16} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-2 px-1 text-[10px] font-bold text-on-accent ring-2 ring-surface-0">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
