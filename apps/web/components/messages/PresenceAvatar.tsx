"use client";

import { UserIcon } from "@krizaka/icons";
import React from "react";

import { timeAgo } from "@/components/notifications/useNotifications";
import { Avatar, cn } from "@/components/ui";
import { t } from "@/lib/i18n";

import type { PresenceView } from "./types";

/** "Online", "Away", "Seen 5 min ago" — or nothing when the presence is not shared. */
export function presenceLabel(view: PresenceView | undefined): string | null {
  if (!view) return null;
  if (view.state === "online") return t("inbox.presence.online");
  if (view.state === "away") return t("inbox.presence.away");
  return view.lastSeenAt ? t("inbox.presence.seen", { when: timeAgo(view.lastSeenAt) }) : null;
}

/**
 * An avatar with its presence: a green dot online, an amber ring away, nothing offline or when it is not shared.
 * The dot is decoration — the label next to it (or `presenceLabel` in an aria-label) says it in words.
 * Local until @krizaka/ui's Avatar carries a status (krizaka/krizaka-ui#74).
 */
export function PresenceAvatar({
  src,
  name,
  presence,
  size = "md",
  className,
}: {
  src: string | null;
  name: string;
  presence?: PresenceView;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const state = presence?.state;
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Avatar src={src} alt="" size={size} fallback={name ? name.charAt(0).toUpperCase() : <UserIcon size={16} />} className="border border-border-default" />
      {(state === "online" || state === "away") && (
        <span
          aria-hidden
          data-presence={state}
          className={cn(
            "absolute bottom-0 right-0 block rounded-full ring-2 ring-surface-1",
            size === "lg" ? "h-3.5 w-3.5" : "h-3 w-3",
            state === "online" ? "bg-success" : "border-2 border-warning bg-surface-1",
          )}
        />
      )}
    </span>
  );
}
