"use client";

import React from "react";
import Link from "next/link";
import { AtSign, Bell, CheckCircle2, Coins, MessageCircle, MessageSquare, PlayCircle, Unlock, UserPlus } from "lucide-react";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { type NotificationItem, timeAgo } from "./useNotifications";

const ICONS: Record<string, { icon: React.ElementType; tone: string }> = {
  newFollower: { icon: UserPlus, tone: "bg-violet-500" },
  contactRequest: { icon: AtSign, tone: "bg-indigo-500" },
  newComment: { icon: MessageCircle, tone: "bg-sky-500" },
  commentReply: { icon: MessageCircle, tone: "bg-sky-500" },
  newMessage: { icon: MessageSquare, tone: "bg-fuchsia-500" },
  tipReceived: { icon: Coins, tone: "bg-emerald-500" },
  videoUnlocked: { icon: Unlock, tone: "bg-emerald-500" },
  videoReady: { icon: CheckCircle2, tone: "bg-teal-500" },
  creatorPublished: { icon: PlayCircle, tone: "bg-pink-500" },
};

/** One notification: who (avatar + event badge), what, when; unread ones are marked. */
export function NotificationRow({ n, onOpen, compact = false }: { n: NotificationItem; onOpen?: () => void; compact?: boolean }) {
  const { icon: Icon, tone } = ICONS[n.event] ?? { icon: Bell, tone: "bg-zinc-500" };
  return (
    <Link
      href={n.path}
      onClick={onOpen}
      className={`group flex items-start gap-3 rounded-xl transition-colors hover:bg-white/5 light:hover:bg-black/[0.04] ${compact ? "p-2.5" : "p-3.5"} ${n.readAt ? "" : "bg-violet-500/[0.07]"}`}
    >
      <span className="relative shrink-0">
        {n.actorAvatar !== undefined && n.actorAvatar !== null ? (
          <img src={n.actorAvatar || AVATAR_PLACEHOLDER} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 light:bg-slate-100">
            <Icon className="h-4 w-4 text-white light:text-slate-700" />
          </span>
        )}
        <span className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full ${tone} ring-2 ring-zinc-950 light:ring-white`}>
          <Icon className="h-2.5 w-2.5 text-white" />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm leading-snug ${n.readAt ? "text-zinc-300 light:text-slate-600" : "font-semibold text-white light:text-slate-900"}`}>{n.text}</span>
        <span className="mt-0.5 block text-[11px] text-zinc-500">{timeAgo(n.createdAt)}</span>
      </span>
      {!n.readAt && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-violet-500" aria-hidden />}
    </Link>
  );
}
