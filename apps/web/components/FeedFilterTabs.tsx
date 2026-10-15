"use client";

import { Clapperboard, Flame, LayoutGrid, Rows3, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useMemo,useState } from "react";

import { Avatar, Badge, buttonVariants, Chip, cn, EmptyState, orochiaButton, Tabs } from "@/components/ui";
import type { VideoCardProps } from "@/components/VideoCard";
import { VideoGrid } from "@/components/VideoGrid";
import { useAuth } from "@/lib/auth-context";
import { feedEmptyActions, type FeedEmptyKind, type FeedTab, type ViewerState } from "@/lib/creator-journey";
import { t } from "@/lib/i18n";
import { aspectClassOf, orientationOf } from "@/lib/video-aspect";

interface FeedFilterTabsProps {
  initialVideos: VideoCardProps[];
  /** The newest videos of the creators the viewer follows (empty when signed out). */
  followingVideos?: VideoCardProps[];
  /** Who is looking: each one gets their own next step under an empty feed (lib/creator-journey.ts). */
  viewer: ViewerState;
  /** The feed could not be read (the database did not answer): say so, never "no video yet". */
  unavailable?: boolean;
}

/**
 * An empty feed, said for the person looking at it: the platform has nothing listed yet, or this tab is empty. Signed in,
 * it never offers the sign-up form — a fan explores or opens their creator space, a creator publishes.
 */
function FeedEmpty({ viewer, kind, tab }: { viewer: ViewerState; kind: FeedEmptyKind; tab: FeedTab }) {
  const { signupEnabled } = useAuth();
  const actions = feedEmptyActions(viewer, kind, tab, signupEnabled);
  return (
    <div
      data-testid="feed-empty"
      data-viewer={viewer}
      className="kz-spotlight relative overflow-hidden rounded-3xl border border-border-default bg-surface-2/40 px-6 py-10 text-center"
    >
      <div aria-hidden className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-accent to-accent-2 shadow-lg shadow-accent/30">
        <Clapperboard className="h-6 w-6 text-on-accent" aria-hidden />
      </div>
      <h3 className="font-display text-xl font-black text-fg">
        {kind === "platform" ? t(`feed.empty.platform.${viewer}.title`) : t(`feed.empty.tab.${tab}.title`)}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-fg-secondary">
        {kind === "platform" ? t(`feed.empty.platform.${viewer}.body`) : t(`feed.empty.tab.${tab}.body`)}
      </p>
      {actions.length > 0 && (
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={a.primary ? orochiaButton({ variant: "sensual", size: "md", shape: "pill" }) : buttonVariants({ variant: "secondary", size: "md", shape: "pill" })}
            >
              {t(a.label)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function FeedFilterTabs({ initialVideos, followingVideos = [], viewer, unavailable = false }: FeedFilterTabsProps) {
  // The open tab lives in the address (?feed=…), so a shared link opens the same feed.
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const asked = params.get("feed");
  const activeTab: FeedTab = asked === "trending" || asked === "following" ? asked : "foryou";
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
      case "following":
        return followingVideos;
      case "foryou":
      default:
        return initialVideos;
    }
  }, [activeTab, initialVideos, followingVideos]);

  const tabs = [
    { id: "foryou", label: t("feed.tabs.foryou"), icon: Flame },
    { id: "following", label: t("feed.tabs.following"), icon: Users },
    { id: "trending", label: t("feed.tabs.trending"), icon: Sparkles },
  ] as const;

  const empty = filteredVideos.length === 0 && (
    unavailable ? (
      <EmptyState
        bird="owl"
        mood="error"
        title={t("feed.empty.unavailable.title")}
        description={t("feed.empty.unavailable.body")}
        className="rounded-3xl bg-surface-2/40"
        action={
          <a href={pathname} className={buttonVariants({ variant: "secondary", size: "sm", shape: "pill" })}>
            {t("feed.empty.unavailable.retry")}
          </a>
        }
      />
    ) : (
      <FeedEmpty viewer={viewer} kind={initialVideos.length === 0 ? "platform" : "tab"} tab={activeTab} />
    )
  );

  const content = (
    <>
      {empty ? (
        empty
      ) : viewMode === "grid" ? (
        /* Shorts shelf for the 9:16, uniform 16:9 grid for the rest */
        <VideoGrid videos={filteredVideos} className="kz-fade" />
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
                  <Avatar src={video.creatorAvatar} defaultAvatar={{ brand: "orochia", seed: video.creatorName }} alt={video.creatorName} fallback={video.creatorName.charAt(0)} className="h-10 w-10 rounded-xl border border-accent/40" />
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-fg group-hover:text-fg-accent transition-colors">
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
              <Link href={`/watch/${video.id}`} className={cn("relative block w-full overflow-hidden bg-media group", aspectClassOf(video.width, video.height), orientationOf(video.width, video.height) === "vertical" && "mx-auto max-w-sm")}>
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-accent/15 via-media to-accent-2/15 text-fg-accent">
                    <span className="font-display text-sm font-bold text-fg-accent">{t("feed.noThumbnail")}</span>
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
                  <span className="text-xs font-bold text-fg-accent font-mono">
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
              <Icon className="h-3.5 w-3.5 text-fg-accent" aria-hidden />
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
