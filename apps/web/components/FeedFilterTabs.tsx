"use client";

import React, { useState, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Clapperboard, Flame, Sparkles, Lock, Gift, Users, LayoutGrid, Rows3 } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { t } from "@/lib/i18n";
import { VideoCard, type VideoCardProps } from "@/components/VideoCard";
import Link from "next/link";

interface FeedFilterTabsProps {
  initialVideos: VideoCardProps[];
}

export function FeedFilterTabs({ initialVideos }: FeedFilterTabsProps) {
  // The open tab lives in the address (?feed=…), so a shared link opens the same feed.
  type FeedTab = "foryou" | "trending" | "vip" | "free" | "contacts";
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const asked = params.get("feed");
  const activeTab: FeedTab = asked === "trending" || asked === "vip" || asked === "free" || asked === "contacts" ? asked : "foryou";
  const setActiveTab = (tab: FeedTab) => {
    const next = new URLSearchParams(params.toString());
    if (tab === "foryou") next.delete("feed");
    else next.set("feed", tab);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
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
    { id: "foryou", label: t("feed.tabs.foryou"), icon: Flame },
    { id: "trending", label: t("feed.tabs.trending"), icon: Sparkles },
    { id: "vip", label: t("feed.tabs.vip"), icon: Lock },
    { id: "free", label: t("feed.tabs.free"), icon: Gift },
    { id: "contacts", label: t("feed.tabs.contacts"), icon: Users },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Tab Control & View Mode Switcher Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 dark:border-white/10 light:border-black/5 pb-4 max-w-full overflow-hidden">
        {/* Feed Selection Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none overscroll-x-contain touch-pan-x">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? "bg-linear-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/25 scale-105"
                    : "border border-white/5 dark:border-white/5 light:border-black/5 bg-zinc-900/50 dark:bg-zinc-900/50 light:bg-slate-100 text-zinc-400 dark:text-zinc-400 light:text-slate-600 hover:text-white dark:hover:text-white hover:light:text-black hover:border-violet-500/40"
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
            aria-label={t("feed.grid")}
            title={t("feed.grid")}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              viewMode === "grid"
                ? "bg-violet-600 text-white shadow-xs"
                : "text-zinc-400 dark:text-zinc-400 light:text-slate-500 hover:text-white"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("cinematic")}
            aria-label={t("feed.cinematic")}
            title={t("feed.cinematic")}
            className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
              viewMode === "cinematic"
                ? "bg-violet-600 text-white shadow-xs"
                : "text-zinc-400 dark:text-zinc-400 light:text-slate-500 hover:text-white"
            }`}
          >
            <Rows3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Video Content Render */}
      {filteredVideos.length === 0 ? (
        initialVideos.length === 0 ? (
          <div className="kz-spotlight relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/40 px-6 py-14 text-center light:border-black/5 light:bg-white">
            <div aria-hidden className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-violet-600 to-pink-600 shadow-lg shadow-fuchsia-600/30">
              <Clapperboard className="h-7 w-7 text-white" />
            </div>
            <h3 className="font-display text-xl font-black text-white light:text-slate-900">{t("home.empty.title")}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400 light:text-slate-600">{t("home.empty.body")}</p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href="/auth/register" className={buttonClass({ variant: "primary", size: "md" })}>
                {t("home.empty.join")}
              </Link>
              <Link href="/creator/upload" className={buttonClass({ variant: "secondary", size: "md" })}>
                {t("home.empty.create")}
              </Link>
            </div>
          </div>
        ) : (
          <p className="rounded-3xl border border-white/10 bg-zinc-900/40 p-10 text-center text-sm text-zinc-400 light:border-black/5 light:bg-white light:text-slate-500">{t("feed.emptyFilter")}</p>
        )
      ) : viewMode === "grid" ? (
        /* Grid Layout */
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 kz-fade">
          {filteredVideos.map((video, i) => (
            <div key={video.id} data-reveal style={{ ["--kz-delay" as string]: `${(i % 4) * 70}ms` }}>
              <VideoCard {...video} />
            </div>
          ))}
        </div>
      ) : (
        /* Cinematic Immersive Stream Feed */
        <div className="max-w-3xl mx-auto space-y-8 kz-fade">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className="overflow-hidden rounded-3xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-950/80 dark:bg-zinc-950/80 light:bg-white shadow-2xl transition-all hover:border-violet-500/40"
            >
              {/* Creator Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/5 dark:border-white/5 light:border-black/5">
                <Link
                  href={video.creatorUsername ? `/@${video.creatorUsername}` : "#"}
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
                      @{video.creatorUsername || t("feed.creatorFallback")}
                    </span>
                  </div>
                </Link>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-violet-600/20 border border-violet-500/30 px-2.5 py-0.5 text-[10px] font-bold text-violet-300">
                    {t("feed.hd")}
                  </span>
                </div>
              </div>

              {/* Large Media Preview */}
              <Link href={`/watch/${video.id}`} className="relative block aspect-video w-full overflow-hidden bg-zinc-900 group">
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-violet-950/40 via-zinc-950 to-fuchsia-950/40 text-violet-400 light:from-violet-100 light:via-slate-50 light:to-fuchsia-100">
                    <span className="font-display text-sm font-bold text-violet-300">{t("feed.noThumbnail")}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent flex items-end p-6">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white drop-shadow-md">
                      {video.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-3 text-xs text-zinc-300 font-mono">
                      <span>{t("feed.views", { count: video.viewsCount.toLocaleString("en-US") })}</span>
                      <span>•</span>
                      <span>{t("feed.minutes", { count: Math.max(1, Math.round(video.durationSeconds / 60)) })}</span>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Actions Bottom Bar */}
              <div className="flex items-center justify-between p-4 bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-slate-50">
                <Link
                  href={`/watch/${video.id}`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:scale-105 transition-all"
                >
                  <span>{t("feed.watch")}</span>
                </Link>

                {video.visibility === "TIPPED_UNLOCKED" && (
                  <span className="text-xs font-bold text-violet-400 font-mono">
                    {t("feed.unlockFor", { price: `$${(video.minTipAmountCents / 100).toFixed(2)}` })}
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
