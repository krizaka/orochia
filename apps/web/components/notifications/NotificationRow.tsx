"use client";

import { AtSign, Bell, CheckCircle2, Coins, Flame, Gavel, Megaphone, MessageCircle, MessageSquare, PlayCircle, Target, Trophy, Undo2, Unlock, UserPlus } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Avatar, cn } from "@/components/ui";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";

import { type NotificationItem, timeAgo } from "./useNotifications";

const ICONS: Record<string, { icon: React.ElementType; tone: string }> = {
  newFollower: { icon: UserPlus, tone: "bg-accent" },
  contactRequest: { icon: AtSign, tone: "bg-accent-2" },
  newComment: { icon: MessageCircle, tone: "bg-info" },
  commentReply: { icon: MessageCircle, tone: "bg-info" },
  newMessage: { icon: MessageSquare, tone: "bg-accent" },
  tipReceived: { icon: Coins, tone: "bg-success" },
  videoUnlocked: { icon: Unlock, tone: "bg-success" },
  videoReady: { icon: CheckCircle2, tone: "bg-success" },
  creatorPublished: { icon: PlayCircle, tone: "bg-accent" },
  auctionAnnounced: { icon: Gavel, tone: "bg-accent" },
  auctionNewBid: { icon: Gavel, tone: "bg-accent" },
  auctionOutbid: { icon: Gavel, tone: "bg-warning" },
  auctionWon: { icon: Trophy, tone: "bg-success" },
  auctionDecision: { icon: Gavel, tone: "bg-accent" },
  auctionSold: { icon: Coins, tone: "bg-success" },
  auctionUnsold: { icon: Gavel, tone: "bg-fg-muted" },
  auctionDeclined: { icon: Undo2, tone: "bg-info" },
  challengeAnnounced: { icon: Target, tone: "bg-accent" },
  challengeRequested: { icon: Flame, tone: "bg-accent" },
  challengePledged: { icon: Coins, tone: "bg-accent" },
  challengeFunded: { icon: Target, tone: "bg-success" },
  challengeAccepted: { icon: Flame, tone: "bg-success" },
  challengeApplied: { icon: Megaphone, tone: "bg-accent-2" },
  challengeChosen: { icon: Trophy, tone: "bg-success" },
  challengeDelivered: { icon: PlayCircle, tone: "bg-success" },
  challengeReleased: { icon: Undo2, tone: "bg-info" },
  challengeClosed: { icon: Flame, tone: "bg-fg-muted" },
};

/** One notification: who (avatar + event badge), what, when; unread ones are marked. */
export function NotificationRow({ n, onOpen, compact = false }: { n: NotificationItem; onOpen?: () => void; compact?: boolean }) {
  const { icon: Icon, tone } = ICONS[n.event] ?? { icon: Bell, tone: "bg-fg-muted" };
  return (
    <Link
      href={n.path}
      onClick={onOpen}
      className={cn(
        "group flex items-start gap-3 rounded-xl transition-colors hover:bg-surface-2",
        compact ? "p-2.5" : "p-3.5",
        n.readAt ? "" : "bg-accent/[0.07]"
      )}
    >
      <span className="relative shrink-0">
        {n.actorAvatar !== undefined && n.actorAvatar !== null ? (
          <Avatar src={n.actorAvatar || AVATAR_PLACEHOLDER} fallback={<Icon className="h-4 w-4" aria-hidden />} />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-3">
            <Icon className="h-4 w-4 text-fg" />
          </span>
        )}
        <span className={cn(
          "absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full",
          tone,
          "ring-2 ring-border-subtle"
        )}>
          <Icon className="h-2.5 w-2.5 text-fg-on-media" aria-hidden />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn(
          "block text-sm leading-snug",
          n.readAt ? "text-fg-secondary" : "font-semibold text-fg"
        )}>{n.text}</span>
        <span className="mt-0.5 block text-[11px] text-fg-muted">{timeAgo(n.createdAt)}</span>
      </span>
      {!n.readAt && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-hidden />}
    </Link>
  );
}
