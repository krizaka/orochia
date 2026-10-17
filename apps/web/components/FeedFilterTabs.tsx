"use client";

import { LoadMore, MediaGridSkeleton } from "@krizaka/ui/media-grid";
import { Clapperboard, Clock, Flame, LayoutGrid, Rows3, Smartphone, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React, { useReducer, useState, useSyncExternalStore } from "react";

import { VerticalFeed } from "@/components/feed/VerticalFeed";
import { Avatar, Badge, buttonVariants, Chip, cn, EmptyState, orochiaButton, Tabs } from "@/components/ui";
import type { VideoCardProps } from "@/components/VideoCard";
import { VideoGrid } from "@/components/VideoGrid";
import { useAuth } from "@/lib/auth-context";
import { feedEmptyActions, type FeedEmptyKind, type FeedTab, type ViewerState } from "@/lib/creator-journey";
import { type FeedSort } from "@/lib/feed-cursor";
import { feedReducer, feedStateOf, type FeedTabId, hasMore, type PageData, TabStatus } from "@/lib/feed-state";
import { FeedLayout, feedLayoutOf, PHONE_QUERY, viewSearch } from "@/lib/feed-view";
import { t } from "@/lib/i18n";
import { defaultAvatarFor } from "@/lib/presets";
import { aspectClassOf, orientationOf } from "@/lib/video-aspect";

interface FeedFilterTabsProps {
  /** The tab the server opened (from `?feed=`) and its first page. */
  initialTab: FeedTab;
  initialPage: PageData<VideoCardProps>;
  /** Who is looking: each one gets their own next step under an empty feed (lib/creator-journey.ts). */
  viewer: ViewerState;
  /** The feed could not be read (the database did not answer): say so, never "no video yet". */
  unavailable?: boolean;
  /** The Shorts limit (`feed` settings): a vertical clip longer than this is a Video. */
  shortsMaxSeconds?: number;
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

const SORT_OF: Record<FeedTab, FeedSort> = { foryou: "foryou", latest: "latest", trending: "trending", following: "following" };
const TAB_OF: Record<FeedTab, FeedTabId> = SORT_OF;

export function FeedFilterTabs({ initialTab, initialPage, viewer, unavailable = false, shortsMaxSeconds }: FeedFilterTabsProps) {
  // The open tab lives in the address (?feed=…), so a shared link opens the same feed. Switching tabs rewrites the address in
  // place (no server round trip): each tab keeps its own pages, and asks for its first one when opened.
  const pathname = usePathname();
  const params = useSearchParams();
  const asked = params.get("feed");
  const activeTab: FeedTab = asked === "trending" || asked === "following" || asked === "latest" ? asked : "foryou";
  const [feeds, dispatch] = useReducer(feedReducer<VideoCardProps>, feedStateOf<VideoCardProps>(TAB_OF[initialTab], initialPage));
  const [viewMode, setViewMode] = useState<"grid" | "cinematic">("grid");
  // A phone gets the vertical feed (one video per screen) unless the address says ?view=grid. The server renders the grid;
  // a phone swaps to the vertical feed once it knows its width.
  const phone = useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(PHONE_QUERY);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
  const layout = feedLayoutOf({ phone, view: params.get("view") });
  const setLayout = (next: FeedLayout) => {
    const search = viewSearch(new URLSearchParams(params.toString()), next);
    window.history.replaceState(null, "", `${pathname}${search.size ? `?${search}` : ""}`);
  };
  const canFollow = viewer !== "anonymous";

  /** Asks for the next page of a tab (its first, if never opened). Called by a click or a scroll — never by an effect. */
  const loadPage = async (tab: FeedTab) => {
    const id = TAB_OF[tab];
    const state = feeds[id];
    if (state.status === TabStatus.Loading || !hasMore(state) || (tab === "following" && !canFollow)) return;
    dispatch({ type: "request", tab: id });
    try {
      const query = new URLSearchParams({ sort: SORT_OF[tab] });
      if (state.nextCursor) query.set("cursor", state.nextCursor);
      const res = await fetch(`/api/feed?${query}`, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as PageData<VideoCardProps>;
      dispatch({ type: "received", tab: id, page: { videos: body.videos, nextCursor: body.nextCursor } });
    } catch {
      dispatch({ type: "failed", tab: id });
    }
  };

  const setActiveTab = (tab: FeedTab) => {
    const next = new URLSearchParams(params.toString());
    if (tab === "foryou") next.delete("feed");
    else next.set("feed", tab);
    window.history.replaceState(null, "", `${pathname}${next.size ? `?${next}` : ""}`);
    if (!feeds[TAB_OF[tab]].loaded) void loadPage(tab);
  };

  const current = feeds[TAB_OF[activeTab]];
  const filteredVideos = current.videos;
  const firstPageWaiting = !current.loaded && (activeTab !== "following" || canFollow);

  const tabs = [
    { id: "foryou", label: t("feed.tabs.foryou"), icon: Flame },
    { id: "following", label: t("feed.tabs.following"), icon: Users },
    { id: "trending", label: t("feed.tabs.trending"), icon: Sparkles },
    { id: "latest", label: t("feed.tabs.latest"), icon: Clock },
  ] as const;

  const empty = !firstPageWaiting && filteredVideos.length === 0 && (
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
      <FeedEmpty viewer={viewer} kind={activeTab === "foryou" ? "platform" : "tab"} tab={activeTab} />
    )
  );

  const content = (
    <>
      {firstPageWaiting ? (
        <MediaGridSkeleton label={t("feed.loadingVideos")} count={8} shelfCount={4} className="kz-fade" />
      ) : empty ? (
        empty
      ) : layout === FeedLayout.Vertical ? (
        <VerticalFeed videos={filteredVideos} shortsMaxSeconds={shortsMaxSeconds} onNearEnd={() => void loadPage(activeTab)} className="kz-fade" />
      ) : viewMode === "grid" ? (
        /* Shorts shelf for the 9:16, uniform 16:9 grid for the rest */
        <VideoGrid videos={filteredVideos} shortsMaxSeconds={shortsMaxSeconds} className="kz-fade" />
      ) : (
        /* Cinematic Immersive Stream Feed */
        <div className="max-w-3xl mx-auto space-y-8 kz-fade">
          {filteredVideos.map((video, index) => (
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
                  <Avatar src={video.creatorAvatar} defaultAvatar={{ brand: "orochia", seed: video.creatorName }} fallbackSrc={defaultAvatarFor(video.creatorName)} alt={video.creatorName} fallback={video.creatorName.charAt(0)} className="h-10 w-10 rounded-xl border border-accent/40" />
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
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : undefined}
                    decoding="async"
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
    {!firstPageWaiting && !empty && (
        <LoadMore
          hasMore={current.nextCursor !== null}
          loading={current.status === TabStatus.Loading}
          failed={current.status === TabStatus.Failed}
          onLoadMore={() => void loadPage(activeTab)}
          label={t("feed.loadMore")}
          retryLabel={t("feed.retry")}
          loadingLabel={t("feed.loadingMore")}
          endLabel={t("feed.end")}
        />
      )}
    </>
  );

  return (
    <Tabs.Root variant="pills" value={activeTab} onValueChange={(tab) => setActiveTab(tab as FeedTab)} data-feed-layout={layout} className={cn(layout === FeedLayout.Vertical ? "relative gap-0" : "gap-6")}>
      {/* The feeds (pills, in the address) and the view (grid or cinema) */}
      {/* In the vertical feed the tabs float over the top of the first screen: the video owns the screen, the feeds stay one tap away. */}
      <div
        data-feed-tabs
        className={cn(
          "flex max-w-full flex-col items-start justify-between gap-4 overflow-hidden border-b border-border-default pb-4 sm:flex-row sm:items-center",
          layout === FeedLayout.Vertical && "pointer-events-none absolute inset-x-0 top-0 z-20 flex-row items-center gap-2 border-0 bg-linear-to-b from-scrim to-transparent px-2 pb-6 pt-2 *:pointer-events-auto",
        )}
      >
        <Tabs.List aria-label={t("feed.label")} className="max-w-full touch-pan-x overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <Tabs.Trigger key={id} value={id} className="font-bold">
              <Icon className="h-3.5 w-3.5 text-fg-accent" aria-hidden />
              <span>{label}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {phone ? (
          <Chip.Group
            type="single"
            required
            size="sm"
            label={t("feed.vertical.viewLabel")}
            value={layout}
            onValueChange={(v) => setLayout(v as FeedLayout)}
            className="shrink-0 gap-1 self-end"
          >
            <Chip value={FeedLayout.Vertical} aria-label={t("feed.vertical.vertical")} title={t("feed.vertical.vertical")} className="w-8 px-0">
              <Smartphone className="h-4 w-4" aria-hidden />
            </Chip>
            <Chip value={FeedLayout.Grid} aria-label={t("feed.vertical.grid")} title={t("feed.vertical.grid")} className="w-8 px-0">
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </Chip>
          </Chip.Group>
        ) : (
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
        )}
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
