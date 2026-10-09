"use client";

import { Clapperboard, Flame, Gift, LayoutGrid, Lock, Rows3,Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useMemo,useState } from "react";

import { Avatar, Badge, buttonVariants, Chip, orochiaButton, Tabs } from "@/components/ui";
import { VideoCard, type VideoCardProps } from "@/components/VideoCard";
import { t } from "@/lib/i18n";

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

  const content = (
    <>
      {filteredVideos.length === 0 ? (
        initialVideos.length === 0 ? (
          <div className="space-y-8">
            <div className="kz-spotlight relative overflow-hidden rounded-3xl border border-border-default bg-surface-2/40 px-6 py-10 text-center">
              <div aria-hidden className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-2 shadow-lg shadow-accent/30">
                <Clapperboard className="h-6 w-6 text-on-accent" aria-hidden />
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
                  <Avatar src={video.creatorAvatar || "/avatar-placeholder.svg"} alt={video.creatorName} fallback={video.creatorName.charAt(0)} className="h-10 w-10 rounded-xl border border-accent/40" />
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
                  <Badge size="sm" tone="accent" className="font-bold">
                    {t("feed.hd")}
                  </Badge>
                </div>
              </div>

              {/* Large Media Preview */}
              <Link href={`/watch/${video.id}`} className="relative block aspect-video w-full overflow-hidden bg-media group">
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-accent/15 via-media to-accent-2/15 text-accent">
                    <span className="font-display text-sm font-bold text-accent">{t("feed.noThumbnail")}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-scrim-strong via-transparent to-transparent flex items-end p-6">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-fg-on-media drop-shadow-md">
                      {video.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-3 text-xs text-fg-on-media/80 font-mono">
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
                  className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 text-xs font-bold text-on-accent shadow-lg shadow-accent/30 hover:scale-105 transition-all"
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
    </>
  );

  return (
    <Tabs.Root variant="pills" value={activeTab} onValueChange={(tab) => setActiveTab(tab as FeedTab)} className="gap-6">
      {/* The feeds (pills, in the address) and the view (grid or cinema) */}
      <div className="flex max-w-full flex-col items-start justify-between gap-4 overflow-hidden border-b border-border-default pb-4 sm:flex-row sm:items-center">
        <Tabs.List aria-label={t("feed.label")} className="max-w-full touch-pan-x">
          {tabs.map(({ id, label, icon: Icon }) => (
            <Tabs.Trigger key={id} value={id} className="font-bold">
              <Icon className="h-3.5 w-3.5 text-accent" aria-hidden />
              <span>{label}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Chip.Group
          type="single"
          required
          size="sm"
          label={t("feed.view")}
          value={viewMode}
          onValueChange={(v) => setViewMode(v as "grid" | "cinematic")}
          className="shrink-0 gap-1 self-end sm:self-auto"
        >
          <Chip value="grid" aria-label={t("feed.grid")} title={t("feed.grid")} className="w-8 px-0">
            <LayoutGrid className="h-4 w-4" aria-hidden />
          </Chip>
          <Chip value="cinematic" aria-label={t("feed.cinematic")} title={t("feed.cinematic")} className="w-8 px-0">
            <Rows3 className="h-4 w-4" aria-hidden />
          </Chip>
        </Chip.Group>
      </div>

      {/* One panel per feed; the open one holds the videos */}
      {tabs.map(({ id }) => (
        <Tabs.Content key={id} value={id}>
          {activeTab === id && content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
