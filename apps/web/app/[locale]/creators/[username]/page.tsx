import { Eye, Film,Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import React from "react";

import { StartChallengeButton } from "@/components/challenges/StartChallengeButton";
import { CreatorProfileClient } from "@/components/CreatorProfileClient";
import { JsonLd } from "@/components/JsonLd";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ShareProfileButton } from "@/components/profile/ShareProfileButton";
import { TipCreatorButton } from "@/components/profile/TipCreatorButton";
import { RelationshipActions } from "@/components/RelationshipActions";
import { ProfileStories } from "@/components/stories/ProfileStories";
import { getCurrentUser } from "@/lib/auth";
import { creatorSpaceCta, viewerStateOf } from "@/lib/creator-journey";
import { getI18n } from "@/lib/i18n-server";
import { visiblePlaylists } from "@/lib/playlists";
import { creatorByUsername, creatorVideos } from "@/lib/queries";
import { profileSchema } from "@/lib/seo";
import { pageAlternates } from "@/lib/seo-i18n";
import { reconcileVideos } from "@/lib/video-reconcile";
import { viewAsOf } from "@/lib/view-as";
import { videoBannerEnabled } from "@/lib/banner";
import { bannerVideoFor } from "@/lib/banner-media";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ username: string }> }) {
  const { t } = await getI18n();
  const params = await props.params;
  const creator = await creatorByUsername(params.username.toLowerCase()).catch(() => null);
  if (!creator) return { title: t("meta.creator") };
  const description = (creator.bio ?? t("meta.creatorDescription", { name: creator.displayName, count: creator.videosCount })).slice(0, 300);
  const images = creator.avatarUrl ? [{ url: creator.avatarUrl, alt: creator.displayName }] : undefined;
  return {
    title: `${creator.displayName} (@${creator.username})`,
    description,
    alternates: await pageAlternates(`/@${creator.username}`),
    openGraph: { type: "profile", url: `/@${creator.username}`, title: t("meta.creatorOg", { name: creator.displayName }), description, images },
    twitter: { card: "summary", title: t("meta.creatorOg", { name: creator.displayName }), description },
  };
}

/** A creator's public luxury page: identity, figures, tiers, goal and published videos */
export default async function CreatorPage(props: { params: Promise<{ username: string }>; searchParams: Promise<{ as?: string | string[] }> }) {
  const { t, number } = await getI18n();
  const params = await props.params;
  const creator = await creatorByUsername(params.username.toLowerCase());
  if (!creator) notFound();
  const viewer = await getCurrentUser();
  // « View as the public » (the owner only): the page is read and drawn as a visitor would see it (orochia#263).
  const preview = viewAsOf((await props.searchParams).as, viewer?.id === creator.id);
  const asVisitor = Boolean(preview);
  // Your own page with nothing in it: your next step to publish (upload · your review · open a creator space).
  const ownCta =
    viewer?.id === creator.id && !asVisitor
      ? creatorSpaceCta(viewerStateOf({ role: creator.isCreator ? "CREATOR" : "MEMBER", isVerified: creator.isVerified }))
      : null;
  const ownEmptyAction = ownCta ? { href: ownCta.href, label: t(ownCta.label) } : undefined;
  // A lost Bunny webhook must not leave posters empty: ask the Stream API about this creator's unsettled videos first.
  await reconcileVideos({ creatorId: creator.id, limit: 10 }).catch(() => undefined);
  const [videos, playlists] = await Promise.all([
    creatorVideos(creator.id, 24, asVisitor ? false : viewer?.isAgeVerified === true),
    visiblePlaylists(creator.id, asVisitor ? null : viewer?.id ?? null),
  ]);

  const stats = creator.isCreator
    ? [
        { icon: Users, label: t("profile.stats.patrons"), value: creator.patrons },
        { icon: Eye, label: t("profile.stats.views"), value: creator.totalViews },
        { icon: Film, label: t("profile.stats.videos"), value: creator.videosCount },
      ]
    : [];
  const links = [...creator.links, ...(creator.websiteUrl ? [{ network: "website" as const, handle: new URL(creator.websiteUrl).hostname.replace(/^www\./, ""), url: creator.websiteUrl }] : [])];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <JsonLd data={profileSchema(creator)} />

      {asVisitor && (
        <div data-testid="view-as-banner" role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-2 px-4 py-3 text-sm text-fg">
          <span>{t("profile.viewAs.banner")}</span>
          <Link href={`/@${creator.username}`} className="font-semibold text-fg-accent hover:underline">
            {t("profile.viewAs.back")}
          </Link>
        </div>
      )}

      <ProfileStories username={creator.username} canAdd={viewer?.id === creator.id && !asVisitor && creator.isCreator}>
        <ProfileHero
          editable={viewer?.id === creator.id && !asVisitor}
          displayName={creator.displayName}
          username={creator.username}
          avatarUrl={creator.avatarUrl}
          bannerUrl={creator.bannerUrl}
          bannerVideo={await bannerVideoFor(creator.id).catch(() => null)}
          movingCover={videoBannerEnabled()}
          verified={creator.isCreator && creator.isVerified}
          roleLabel={creator.isCreator ? t("profile.creator") : undefined}
          bio={creator.bio}
          links={links}
          stats={stats.map((s) => ({ label: s.label, value: number(s.value) }))}
          actions={
            <>
              {viewer?.id === creator.id && !asVisitor ? (
                <>
                <Link
                  href={`/@${creator.username}?as=public`}
                  className="inline-flex items-center gap-2 rounded-xl border border-border-default px-4 py-2.5 text-xs font-semibold text-fg transition-colors hover:border-accent/60 hover:bg-accent/10"
                >
                  {t("profile.viewAs.cta")}
                </Link>
                <Link
                  href="/me/settings#settings-profile"
                  className="inline-flex items-center gap-2 rounded-xl border border-border-default px-4 py-2.5 text-xs font-semibold text-fg transition-colors hover:border-accent/60 hover:bg-accent/10"
                >
                  {t("profile.editProfile")}
                </Link>
                </>
              ) : asVisitor ? null : (
                <>
                  <RelationshipActions username={creator.username} />
                  {creator.isCreator && creator.isVerified && videos[0] && (
                    <TipCreatorButton creatorName={creator.displayName} videoId={videos[0].id} minTipAmountCents={creator.minTipAmountCents} />
                  )}
                  {creator.isCreator && creator.isVerified && (
                    <StartChallengeButton
                      signedIn={Boolean(viewer)}
                      isCreator={viewer?.role === "CREATOR"}
                      kind="REQUEST"
                      creatorUsername={creator.username}
                      label={t("challenge.dare")}
                      variant="secondary"
                    />
                  )}
                </>
              )}
              <ShareProfileButton username={creator.username} displayName={creator.displayName} />
            </>
          }
        />
      </ProfileStories>

      {/* Interactive Client Sections (Goal, Tiers, Categorized Media Tabs) */}
      <CreatorProfileClient
        creator={creator}
        videos={videos}
        playlists={playlists}
        emptyAction={ownEmptyAction}
      />
    </div>
  );
}
