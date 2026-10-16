import React from "react";
import { notFound } from "next/navigation";
import { Users, Eye, Film } from "lucide-react";
import { creatorByUsername, creatorVideos } from "@/lib/queries";
import { visiblePlaylists } from "@/lib/playlists";
import { getCurrentUser } from "@/lib/auth";
import { RelationshipActions } from "@/components/RelationshipActions";
import { JsonLd } from "@/components/JsonLd";
import { profileSchema } from "@/lib/seo";
import { CreatorProfileClient } from "@/components/CreatorProfileClient";
import Link from "next/link";
import { ProfileHero } from "@/components/profile/ProfileHero";
import { ProfileStories } from "@/components/stories/ProfileStories";
import { ShareProfileButton } from "@/components/profile/ShareProfileButton";
import { StartChallengeButton } from "@/components/challenges/StartChallengeButton";
import { creatorSpaceCta, viewerStateOf } from "@/lib/creator-journey";
import { t } from "@/lib/i18n";
import { reconcileVideos } from "@/lib/video-reconcile";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const creator = await creatorByUsername(params.username.toLowerCase()).catch(() => null);
  if (!creator) return { title: "Creator" };
  const description = (creator.bio ?? `${creator.displayName} — independent creator on Orochia, ${creator.videosCount} videos.`).slice(0, 300);
  const images = creator.avatarUrl ? [{ url: creator.avatarUrl, alt: creator.displayName }] : undefined;
  return {
    title: `${creator.displayName} (@${creator.username})`,
    description,
    alternates: { canonical: `/@${creator.username}` },
    openGraph: { type: "profile", url: `/@${creator.username}`, title: `${creator.displayName} on Orochia`, description, images },
    twitter: { card: "summary", title: `${creator.displayName} on Orochia`, description },
  };
}

/** A creator's public luxury page: identity, figures, tiers, goal and published videos */
export default async function CreatorPage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const creator = await creatorByUsername(params.username.toLowerCase());
  if (!creator) notFound();
  const viewer = await getCurrentUser();
  // Your own page with nothing in it: your next step to publish (upload · your review · open a creator space).
  const ownCta =
    viewer?.id === creator.id
      ? creatorSpaceCta(viewerStateOf({ role: creator.isCreator ? "CREATOR" : "MEMBER", isVerified: creator.isVerified }))
      : null;
  const ownEmptyAction = ownCta ? { href: ownCta.href, label: t(ownCta.label) } : undefined;
  // A lost Bunny webhook must not leave posters empty: ask the Stream API about this creator's unsettled videos first.
  await reconcileVideos({ creatorId: creator.id, limit: 10 }).catch(() => undefined);
  const [videos, playlists] = await Promise.all([
    creatorVideos(creator.id, 24, viewer?.isAgeVerified === true),
    visiblePlaylists(creator.id, viewer?.id ?? null),
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

      <ProfileStories username={creator.username} canAdd={viewer?.id === creator.id && creator.isCreator}>
        <ProfileHero
          editable={viewer?.id === creator.id}
          displayName={creator.displayName}
          username={creator.username}
          avatarUrl={creator.avatarUrl}
          bannerUrl={creator.bannerUrl}
          verified={creator.isCreator && creator.isVerified}
          roleLabel={creator.isCreator ? t("profile.creator") : undefined}
          bio={creator.bio}
          links={links}
          stats={stats.map((s) => ({ label: s.label, value: s.value.toLocaleString("en-US") }))}
          actions={
            <>
              {viewer?.id === creator.id ? (
                <Link
                  href="/dashboard?tab=settings#settings-profile"
                  className="inline-flex items-center gap-2 rounded-xl border border-border-default px-4 py-2.5 text-xs font-semibold text-fg transition-colors hover:border-accent/60 hover:bg-accent/10"
                >
                  {t("profile.editProfile")}
                </Link>
              ) : (
                <>
                  <RelationshipActions username={creator.username} />
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
