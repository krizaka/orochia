"use client";

import React, { useState, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Clapperboard, Flame, Sparkles, Lock, Gift, Users, LayoutGrid, Rows3 } from "lucide-react";
import { orochiaButton, buttonVariants, cn } from "@/components/ui";
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-default pb-4 max-w-full overflow-hidden">
        {/* Feed Selection Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none overscroll-x-contain touch-pan-x">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold transition-all shrink-0",
                  isActive
                    ? "bg-linear-to-r from-accent to-accent-2 text-white shadow-lg shadow-accent/25 scale-105"
                    : "border border-border-subtle bg-surface-2/50 text-fg-secondary hover:text-fg hover:border-accent/40"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-white" : "text-accent")} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* View Mode Switcher (Grid vs Cinematic) */}
        <div className="flex items-center gap-1 rounded-2xl border border-border-default bg-surface-2/60 p-1 self-end sm:self-auto shrink-0">
          <button
            onClick={() => setViewMode("grid")}
            aria-label={t("feed.grid")}
            title={t("feed.grid")}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
              viewMode === "grid"
                ? "bg-accent text-white shadow-xs"
                : "text-fg-secondary hover:text-white"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("cinematic")}
            aria-label={t("feed.cinematic")}
            title={t("feed.cinematic")}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
              viewMode === "cinematic"
                ? "bg-accent text-white shadow-xs"
                : "text-fg-secondary hover:text-white"
            )}
          >
            <Rows3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Video Content Render */}
      {filteredVideos.length === 0 ? (
        initialVideos.length === 0 ? (
          <div className="space-y-8">
            <div className="kz-spotlight relative overflow-hidden rounded-3xl border border-border-default bg-surface-2/40 px-6 py-10 text-center">
              <div aria-hidden className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-2 shadow-lg shadow-accent/30">
                <Clapperboard className="h-6 w-6 text-white" />
              </div>
              <h3 className="font-display text-xl font-black text-fg">{t("home.empty.title")}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-fg-secondary">{t("home.empty.body")}</p>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                <Link href="/auth/register" className={orochiaButton({ variant: "sensual", size: "md", shape: "pill" })}>
                  {t("home.empty.join")}
                </Link>
                <Link href="/creator/upload" className={buttonVariants({ variant: "secondary", size: "md", shape: "pill" })}>
                  {t("home.empty.create")}
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <p className="rounded-3xl border border-border-default bg-surface-2/40 p-10 text-center text-sm text-fg-secondary">{t("feed.emptyFilter")}</p>
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
              className="overflow-hidden rounded-3xl border border-border-default bg-surface-1/80 shadow-2xl transition-all hover:border-accent/40"
            >
              {/* Creator Header */}
              <div className="flex items-center justify-between p-4 border-b border-border-subtle">
                <Link
                  href={video.creatorUsername ? `/@${video.creatorUsername}` : "#"}
                  className="flex items-center gap-3 group"
                >
                  <div className="h-10 w-10 overflow-hidden rounded-xl border border-accent/40">
                    <img
                      src={video.creatorAvatar || "/avatar-placeholder.svg"}
                      alt={video.creatorName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-fg group-hover:text-accent transition-colors">
                      {video.creatorName}
                    </h4>
                    <span className="text-[11px] text-fg-secondary font-mono">
                      @{video.creatorUsername || t("feed.creatorFallback")}
                    </span>
                  </div>
                </Link>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-accent/20 border border-accent/30 px-2.5 py-0.5 text-[10px] font-bold text-accent">
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
                  <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-accent/15 via-zinc-950 to-accent-2/15 text-accent light:via-slate-50">
                    <span className="font-display text-sm font-bold text-accent">{t("feed.noThumbnail")}</span>
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
              <div className="flex items-center justify-between p-4 bg-surface-2/40">
                <Link
                  href={`/watch/${video.id}`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-accent/30 hover:scale-105 transition-all"
                >
                  <span>{t("feed.watch")}</span>
                </Link>

                {video.visibility === "TIPPED_UNLOCKED" && (
                  <span className="text-xs font-bold text-accent font-mono">
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
