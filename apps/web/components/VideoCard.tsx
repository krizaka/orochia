"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Lock, Users, Sparkles, Eye } from "lucide-react";

export interface VideoCardProps {
  id: string;
  title: string;
  creatorName: string;
  creatorAvatar?: string | null;
  thumbnailUrl?: string | null;
  previewAnimationUrl?: string | null;
  durationSeconds: number;
  visibility: "PUBLIC" | "CONTACTS_ONLY" | "APPROVED_FOLLOWERS_ONLY" | "TIPPED_UNLOCKED" | "INVITED_ONLY";
  minTipAmountCents: number;
  viewsCount: number;
  tipsCount: number;
}

export function VideoCard({
  id,
  title,
  creatorName,
  creatorAvatar,
  thumbnailUrl,
  previewAnimationUrl,
  durationSeconds,
  visibility,
  minTipAmountCents,
  viewsCount,
  tipsCount,
}: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isPaywalled = visibility === "TIPPED_UNLOCKED";
  const isContacts = visibility === "CONTACTS_ONLY";

  return (
    <Link
      href={`/watch/${id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group block overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/50 hover:border-violet-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-violet-950/20"
    >
      {/* Thumbnail Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
        <img
          src={
            isHovered && previewAnimationUrl
              ? previewAnimationUrl
              : thumbnailUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80"
          }
          alt={title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Duration badge */}
        <div className="absolute bottom-2.5 right-2.5 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-mono font-medium text-white backdrop-blur-md">
          {formatDuration(durationSeconds)}
        </div>

        {/* Paywall or Contacts Badge */}
        {isPaywalled && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-violet-600/90 px-3 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur-md">
            <Lock className="h-3 w-3" />
            <span>Tip ${(minTipAmountCents / 100).toFixed(2)} to Unlock</span>
          </div>
        )}

        {isContacts && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-zinc-800/90 px-3 py-1 text-[11px] font-semibold text-zinc-300 backdrop-blur-md">
            <Users className="h-3 w-3" />
            <span>Contacts Only</span>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="p-4">
        <div className="flex gap-3">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-zinc-800">
            <img
              src={creatorAvatar || "/avatar-placeholder.svg"}
              alt={creatorName}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-semibold text-white group-hover:text-violet-400 transition-colors">
              {title}
            </h3>
            <p className="mt-1 text-xs text-zinc-400">{creatorName}</p>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500 font-mono">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {viewsCount.toLocaleString()}
              </span>
              {tipsCount > 0 && (
                <span className="flex items-center gap-1 text-fuchsia-400">
                  <Sparkles className="h-3 w-3" />
                  {tipsCount} tips
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
