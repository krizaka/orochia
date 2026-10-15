import Link from "next/link";
import React from "react";

import { FeedFilterTabs } from "@/components/FeedFilterTabs";
import { StoriesRail } from "@/components/home/StoriesRail";
import { Button, cn } from "@/components/ui";
import { signInHref, signUpHref } from "@/lib/creator-journey";
import { signupEnabled } from "@/lib/features";
import { t } from "@/lib/i18n";
import { listFeed, listFollowingFeed } from "@/lib/queries";
import { getViewer } from "@/lib/viewer";

export const metadata = { alternates: { canonical: "/" } };
export const dynamic = "force-dynamic";

/**
 * Home is the feed, like the platforms people know: For you · Following · Trending, a Shorts shelf for the vertical clips
 * and one uniform 16:9 grid for the rest. A visitor gets one line above it (what this is, Explore / Sign in); the pitch
 * — how it works, the 90 %, the four ways to support — lives on /how-it-works. Everything shown is read from the database:
 * an empty platform shows empty states, never invented creators or figures (AGENTS.md §3.F).
 */
async function loadHome(viewerId: string | null, viewerAgeChecked: boolean) {
  try {
    const [videos, following] = await Promise.all([listFeed(48, viewerAgeChecked), viewerId ? listFollowingFeed(viewerId, 48, viewerAgeChecked) : Promise.resolve([])]);
    return { videos, following, unavailable: false };
  } catch (error) {
    // Said as such under the feed ("could not load"), never as an empty platform.
    console.error("[home] feed unavailable:", error);
    return { videos: [], following: [], unavailable: true };
  }
}

export default async function HomePage() {
  const { user: viewer, state: viewerState } = await getViewer();
  const { videos, following, unavailable } = await loadHome(viewer?.id ?? null, viewer?.isAgeVerified === true);
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
      <div className={cn(container, "py-6 sm:py-8")}>
        {viewer && <StoriesRail />}
        <section aria-label={t("feed.label")} className={viewer ? "mt-6" : undefined}>
          <FeedFilterTabs initialVideos={videos} followingVideos={following} viewer={viewerState} unavailable={unavailable} />
        </section>
      </div>
    </div>
  );
}
