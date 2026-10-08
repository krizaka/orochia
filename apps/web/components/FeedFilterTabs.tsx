"use client";

import React, { useState, useMemo } from "react";
import { Flame, Sparkles, Lock, Gift, Users, LayoutGrid, Rows3 } from "lucide-react";
import { VideoCard, type VideoCardProps } from "@/components/VideoCard";
import Link from "next/link";

interface FeedFilterTabsProps {
  initialVideos: VideoCardProps[];
}

export function FeedFilterTabs({ initialVideos }: FeedFilterTabsProps) {
  const [activeTab, setActiveTab] = useState<"foryou" | "trending" | "vip" | "free" | "contacts">("foryou");
  const [viewMode, setViewMode] = useState<"grid" | "cinematic">("grid");

  const filteredVideos = useMemo(() => {
    switch (activeTab) {
      case "trending":
        return [...initialVideos].sort((a, b) => b.viewsCount - a.viewsCount);
      case "vip":
        return initialVideos.filter((v) => v.visibility === "TIPPED_UNLOCKED");
      case "free":
        return initialVideos.filter((v) => v.visibility === "PUBLIC");
      case "contacts":
        return initialVideos.filter((v) => v.visibility === "CONTACTS_ONLY");
      case "foryou":
      default:
        return initialVideos;
    }
  }, [activeTab, initialVideos]);

  const tabs = [
    { id: "foryou", label: "For You", icon: Flame },
    { id: "trending", label: "Trending 4K", icon: Sparkles },
    { id: "vip", label: "VIP & PPV", icon: Lock },
    { id: "free", label: "Free Previews", icon: Gift },
    { id: "contacts", label: "Contacts Only", icon: Users },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Tab Control & View Mode Switcher Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 dark:border-white/10 light:border-black/5 pb-4">
        {/* Feed Selection Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/25 scale-105"
                    : "border border-white/5 dark:border-white/5 light:border-black/5 bg-zinc-900/50 dark:bg-zinc-900/50 light:bg-slate-100 text-zinc-400 dark:text-zinc-400 light:text-slate-600 hover:text-white dark:hover:text-white light:hover:text-black hover:border-violet-500/40"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-violet-400"}`} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* View Mode Switcher (Grid vs Cinematic) */}
        <div className="flex items-center gap-1 rounded-2xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/60 dark:bg-zinc-900/60 light:bg-slate-100 p-1 self-end sm:self-auto shrink-0">
          <button
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            title="Grid view"
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              viewMode === "grid"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-zinc-400 dark:text-zinc-400 light:text-slate-500 hover:text-white"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("cinematic")}
            aria-label="Cinematic view"
            title="Cinematic stream view"
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              viewMode === "cinematic"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-zinc-400 dark:text-zinc-400 light:text-slate-500 hover:text-white"
            }`}
          >
            <Rows3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Video Content Render */}
      {filteredVideos.length === 0 ? (
        <div className="rounded-3xl border border-white/10 dark:border-white/10 light:border-black/5 bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-slate-50 p-12 text-center">
          <p className="text-sm font-semibold text-white dark:text-white light:text-slate-900">
            No streams found in this category.
          </p>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-400 light:text-slate-500">
            Switch tabs or explore published broadcasts by our verified creators.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* Grid Layout */
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in duration-300">
          {filteredVideos.map((video) => (
            <VideoCard key={video.id} {...video} />
          ))}
        </div>
      ) : (
        /* Cinematic Immersive Stream Feed */
        <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className="overflow-hidden rounded-3xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-950/80 dark:bg-zinc-950/80 light:bg-white shadow-2xl transition-all hover:border-violet-500/40"
            >
              {/* Creator Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/5 dark:border-white/5 light:border-black/5">
                <Link
                  href={video.creatorUsername ? `/creators/${video.creatorUsername}` : "#"}
                  className="flex items-center gap-3 group"
                >
                  <div className="h-10 w-10 overflow-hidden rounded-xl border border-violet-500/40">
                    <img
                      src={video.creatorAvatar || "/avatar-placeholder.svg"}
                      alt={video.creatorName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white dark:text-white light:text-slate-900 group-hover:text-violet-400 transition-colors">
                      {video.creatorName}
                    </h4>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-400 light:text-slate-500 font-mono">
                      @{video.creatorUsername || "creator"}
                    </span>
                  </div>
                </Link>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-violet-600/20 border border-violet-500/30 px-2.5 py-0.5 text-[10px] font-bold text-violet-300">
                    4K HLS
                  </span>
                </div>
              </div>

              {/* Large Media Preview */}
              <Link href={`/watch/${video.id}`} className="relative block aspect-video w-full overflow-hidden bg-zinc-900 group">
                <img
                  src={video.thumbnailUrl || "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80"}
                  alt={video.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-6">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white drop-shadow-md">
                      {video.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-3 text-xs text-zinc-300 font-mono">
                      <span>{video.viewsCount.toLocaleString()} views</span>
                      <span>•</span>
                      <span>{Math.floor(video.durationSeconds / 60)} min stream</span>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Actions Bottom Bar */}
              <div className="flex items-center justify-between p-4 bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-slate-50">
                <Link
                  href={`/watch/${video.id}`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:scale-105 transition-all"
                >
                  <span>Watch Stream</span>
                </Link>

                {video.visibility === "TIPPED_UNLOCKED" && (
                  <span className="text-xs font-bold text-violet-400 font-mono">
                    Unlock for ${(video.minTipAmountCents / 100).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
