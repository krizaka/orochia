import Link from "next/link";
import React from "react";

import { FeedFilterTabs } from "@/components/FeedFilterTabs";
import { StoriesRail } from "@/components/home/StoriesRail";
import { Button, cn } from "@/components/ui";
import { signInHref, signUpHref } from "@/lib/creator-journey";
import { signupEnabled } from "@/lib/features";
import { FeedSort } from "@/lib/feed-cursor";
import { feedSettings } from "@/lib/feed-settings";
import { t } from "@/lib/i18n";
import { feedPage } from "@/lib/queries";
import { getViewer } from "@/lib/viewer";

export const metadata = { alternates: { canonical: "/" } };
export const dynamic = "force-dynamic";

/**
 * Home is the feed, like the platforms people know: For you (Orazaka's recommendations, or trending blended with fresh for a visitor) · Following · Trending (engagement velocity) · Latest (chronological, only when chosen), a Shorts shelf for the vertical clips
 * and one uniform 16:9 grid for the rest. A visitor gets one line above it (what this is, Explore / Sign in); the pitch
 * — how it works, the 90 %, the four ways to support — lives on /how-it-works. Everything shown is read from the database:
 * an empty platform shows empty states, never invented creators or figures (AGENTS.md §3.F).
 */
const TAB_SORT = { foryou: FeedSort.ForYou, latest: FeedSort.Latest, trending: FeedSort.Trending, following: FeedSort.Following } as const;

/** The open tab's first page, read on the server; the next pages come one at a time (`/api/feed?sort=…&cursor=…`). */
async function loadHome(sort: FeedSort, viewerId: string | null, viewerAgeChecked: boolean) {
  try {
    if (sort === FeedSort.Following && !viewerId) return { page: { videos: [], nextCursor: null }, unavailable: false };
    return { page: await feedPage({ sort, viewerId }, viewerAgeChecked), unavailable: false };
  } catch (error) {
    // Said as such under the feed ("could not load"), never as an empty platform.
    console.error("[home] feed unavailable:", error);
    return { page: { videos: [], nextCursor: null }, unavailable: true };
  }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ feed?: string | string[] }> }) {
  const { user: viewer, state: viewerState } = await getViewer();
  const { feed } = await searchParams;
  const asked = Array.isArray(feed) ? feed[0] : feed;
  const tab = asked === "trending" || asked === "following" || asked === "latest" ? asked : "foryou";
  const { shortsMaxSeconds } = await feedSettings(new Date()).catch(() => ({ shortsMaxSeconds: undefined }));
  const { page, unavailable } = await loadHome(TAB_SORT[tab], viewer?.id ?? null, viewer?.isAgeVerified === true);
  const container = "mx-auto w-full max-w-7xl px-4 sm:px-6";
  return (
    <div className="w-full overflow-x-clip">
      <h1 className="sr-only">{viewer ? t("home.member.title", { name: viewer.username }) : t("home.heroTitle")}</h1>
      {!viewer && (
        <div data-testid="home-intro" className="border-b border-border-default bg-surface-1/60">
          <div className={cn(container, "flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between")}>
            <p className="text-sm text-fg-secondary sm:text-base">
              <span className="font-semibold text-fg">{t("home.intro.line")}</span> {t("home.intro.sub")}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button asChild variant="primary" size="md" shape="cut">
                <Link href="/explore">{t("home.ctaExplore")}</Link>
              </Button>
              <Button asChild variant="secondary" size="md" shape="cut">
                <Link href={signupEnabled() ? signUpHref() : signInHref()}>{t(signupEnabled() ? "home.intro.join" : "feed.actions.signIn")}</Link>
              </Button>
              <Button asChild variant="ghost" size="md">
                <Link href="/how-it-works">{t("home.ctaHow")}</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
      <div data-feed-container className={cn(container, "py-6 sm:py-8")}>
        {viewer && <div data-feed-chrome><StoriesRail /></div>}
        <section aria-label={t("feed.label")} className={viewer ? "mt-6" : undefined}>
          <FeedFilterTabs initialTab={tab} initialPage={page} viewer={viewerState} unavailable={unavailable} shortsMaxSeconds={shortsMaxSeconds} />
        </section>
      </div>
    </div>
  );
}
