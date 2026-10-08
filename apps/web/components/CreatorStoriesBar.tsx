"use client";

import React, { useState, useEffect } from "react";
import { Plus, X, Sparkles, Heart, ChevronLeft, ChevronRight, CheckCircle2, Tv } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

interface StoryItem {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isLive?: boolean;
  hasUnread?: boolean;
  storyMedia: {
    type: "video" | "image";
    url: string;
    caption: string;
    timestamp: string;
  };
}

const DEFAULT_STORIES: StoryItem[] = [
  {
    id: "story-elena",
    username: "elenavox",
    displayName: "Elena Vox",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    isLive: true,
    hasUnread: true,
    storyMedia: {
      type: "image",
      url: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80",
      caption: "🔴 Live from nocturnal production suite. Special 4K teaser dropping tonight! ⚡",
      timestamp: "12m ago",
    },
  },
  {
    id: "story-mia",
    username: "miasterling",
    displayName: "Mia Sterling",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
    isLive: false,
    hasUnread: true,
    storyMedia: {
      type: "image",
      url: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80",
      caption: "Late-night studio acoustics and unreleased vocal stems for VIP patrons 🎶✨",
      timestamp: "45m ago",
    },
  },
  {
    id: "story-nova",
    username: "novaray",
    displayName: "Nova Ray",
    avatarUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80",
    isLive: false,
    hasUnread: true,
    storyMedia: {
      type: "image",
      url: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=1200&q=80",
      caption: "Cyberpunk visuals and raw aesthetic edits. Check out my new public stream! 💜",
      timestamp: "2h ago",
    },
  },
  {
    id: "story-sanctuary",
    username: "orochia_admin",
    displayName: "Orochia Vault",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
    isLive: false,
    hasUnread: false,
    storyMedia: {
      type: "image",
      url: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
      caption: "New Bunny edge transcoder nodes deployed worldwide: sub-50ms HLS latency globally! 🚀",
      timestamp: "5h ago",
    },
  },
];

export function CreatorStoriesBar() {
  const { user } = useAuth();
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [liked, setLiked] = useState(false);
  const [tippedSuccess, setTippedSuccess] = useState(false);

  // Auto-progress story timer
  useEffect(() => {
    if (activeStoryIndex === null) {
      setStoryProgress(0);
      return;
    }

    setLiked(false);
    setTippedSuccess(false);
    const duration = 7000; // 7 seconds per story
    const intervalTime = 50;
    const increment = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev >= 100) {
          // Advance to next story or close
          if (activeStoryIndex < DEFAULT_STORIES.length - 1) {
            setActiveStoryIndex(activeStoryIndex + 1);
            return 0;
          } else {
            setActiveStoryIndex(null);
            return 0;
          }
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [activeStoryIndex]);

  const activeStory = activeStoryIndex !== null ? DEFAULT_STORIES[activeStoryIndex] : null;

  return (
    <>
      {/* Stories Horizontal Carousel Bar */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-white/10 dark:border-white/10 light:border-black/5 bg-zinc-950/60 dark:bg-zinc-950/60 light:bg-white p-3.5 sm:p-4 backdrop-blur-xl">
        <div className="flex items-center gap-4 sm:gap-5 overflow-x-auto scrollbar-none py-1 px-1">
          {/* Creator Upload / Add Story Button */}
          {user?.role === "CREATOR" ? (
            <Link
              href="/creator/upload"
              className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer"
            >
              <div className="relative flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-2xl border-2 border-dashed border-violet-500/60 bg-violet-600/10 transition-transform group-hover:scale-105">
                <Plus className="h-6 w-6 text-violet-400 group-hover:rotate-90 transition-transform duration-300" />
              </div>
              <span className="text-[11px] font-semibold text-zinc-300 dark:text-zinc-300 light:text-slate-700">Add Story</span>
            </Link>
          ) : (
            <div className="hidden sm:flex flex-col items-center gap-1.5 shrink-0">
              <div className="flex h-16 w-16 sm:h-18 sm:w-18 items-center justify-center rounded-2xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/60 dark:bg-zinc-900/60 light:bg-slate-100 text-violet-400">
                <Sparkles className="h-6 w-6" />
              </div>
              <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-400 light:text-slate-500">Live Fleets</span>
            </div>
          )}

          {/* Stories List */}
          {DEFAULT_STORIES.map((story, idx) => (
            <button
              key={story.id}
              onClick={() => setActiveStoryIndex(idx)}
              className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
            >
              {/* Avatar with Animated Pulse Border */}
              <div className="relative p-0.5 rounded-2xl transition-transform group-hover:scale-105 active:scale-95">
                <div
                  className={`absolute inset-0 rounded-2xl ${
                    story.isLive
                      ? "bg-gradient-to-tr from-rose-500 via-fuchsia-500 to-amber-400 animate-pulse"
                      : story.hasUnread
                      ? "bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-pink-500"
                      : "bg-zinc-700 dark:bg-zinc-700 light:bg-slate-300"
                  }`}
                />
                <div className="relative h-15 w-15 sm:h-16 sm:w-16 overflow-hidden rounded-[14px] bg-zinc-950 p-0.5">
                  <img
                    src={story.avatarUrl}
                    alt={story.displayName}
                    className="h-full w-full object-cover rounded-[12px]"
                  />
                </div>

                {/* Live Badge */}
                {story.isLive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-rose-600 px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider text-white ring-2 ring-zinc-950 shadow-md">
                    LIVE
                  </span>
                )}
              </div>

              {/* Creator Name */}
              <span className="max-w-[72px] truncate text-[11px] font-medium text-zinc-200 dark:text-zinc-200 light:text-slate-800 group-hover:text-violet-400 transition-colors">
                {story.displayName}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Story Viewer Modal */}
      {activeStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-2 sm:p-6 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm sm:max-w-md h-[88vh] max-h-[750px] overflow-hidden rounded-3xl border border-white/15 bg-zinc-950 shadow-2xl flex flex-col justify-between">
            {/* Background Story Media */}
            <div className="absolute inset-0 z-0">
              <img
                src={activeStory.storyMedia.url}
                alt=""
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90" />
            </div>

            {/* Top Bar: Progress Indicator + Creator Info */}
            <div className="relative z-10 p-4">
              {/* Story Timer Bar */}
              <div className="flex gap-1.5 mb-3">
                {DEFAULT_STORIES.map((_, i) => (
                  <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                    <div
                      className="h-full bg-white transition-all duration-75 ease-linear"
                      style={{
                        width:
                          i < (activeStoryIndex ?? 0)
                            ? "100%"
                            : i === activeStoryIndex
                            ? `${storyProgress}%`
                            : "0%",
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Creator Info */}
              <div className="flex items-center justify-between">
                <Link
                  href={`/creators/${activeStory.username}`}
                  onClick={() => setActiveStoryIndex(null)}
                  className="flex items-center gap-2.5 group"
                >
                  <img
                    src={activeStory.avatarUrl}
                    alt={activeStory.displayName}
                    className="h-9 w-9 rounded-xl border border-white/20 object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white group-hover:text-violet-400 transition-colors">
                        {activeStory.displayName}
                      </span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <span className="text-[10px] text-zinc-300 font-mono">
                      {activeStory.storyMedia.timestamp}
                    </span>
                  </div>
                </Link>

                <button
                  onClick={() => setActiveStoryIndex(null)}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Middle Nav Taps */}
            <div className="relative z-10 flex-1 flex items-center justify-between px-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeStoryIndex !== null && activeStoryIndex > 0) setActiveStoryIndex(activeStoryIndex - 1);
                }}
                disabled={activeStoryIndex === 0 || activeStoryIndex === null}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-black/40 text-white disabled:opacity-0 hover:bg-black/70 transition-all"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeStoryIndex !== null && activeStoryIndex < DEFAULT_STORIES.length - 1) {
                    setActiveStoryIndex(activeStoryIndex + 1);
                  } else {
                    setActiveStoryIndex(null);
                  }
                }}
                className="h-10 w-10 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/70 transition-all"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Bottom Caption, Tip Button & Interactive Actions */}
            <div className="relative z-10 p-5 space-y-3">
              <p className="text-xs sm:text-sm text-white/95 drop-shadow leading-relaxed">
                {activeStory.storyMedia.caption}
              </p>

              {tippedSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/80 p-2 text-center text-xs font-semibold text-emerald-300 animate-in zoom-in-95">
                  🎉 You sent a $5 tip to {activeStory.displayName}! Thank you for supporting sovereign art!
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                {/* Instant Tip Action Button */}
                <button
                  onClick={() => setTippedSuccess(true)}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Send $5 Instant Tip</span>
                </button>

                {/* Like Button */}
                <button
                  onClick={() => setLiked(!liked)}
                  className={`h-11 w-11 flex items-center justify-center rounded-2xl border transition-all ${
                    liked
                      ? "border-rose-500 bg-rose-500/20 text-rose-400 scale-110"
                      : "border-white/20 bg-black/50 text-white hover:bg-black/70"
                  }`}
                >
                  <Heart className={`h-5 w-5 ${liked ? "fill-rose-500" : ""}`} />
                </button>

                {/* Profile Link */}
                <Link
                  href={`/creators/${activeStory.username}`}
                  onClick={() => setActiveStoryIndex(null)}
                  className="h-11 w-11 flex items-center justify-center rounded-2xl border border-white/20 bg-black/50 text-white hover:bg-black/70 transition-colors"
                  title="View full profile"
                >
                  <Tv className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
