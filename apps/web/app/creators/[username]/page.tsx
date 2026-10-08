import React from "react";
import { notFound } from "next/navigation";
import { ShieldCheck, Users, Eye, Film, Sparkles, Heart } from "lucide-react";
import { creatorByUsername, creatorVideos } from "@/lib/queries";
import { visiblePlaylists } from "@/lib/playlists";
import { getCurrentUser } from "@/lib/auth";
import { RelationshipActions } from "@/components/RelationshipActions";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { JsonLd } from "@/components/JsonLd";
import { profileSchema } from "@/lib/seo";
import { CreatorProfileClient } from "@/components/CreatorProfileClient";
import { SocialIcon } from "@/components/SocialIcon";
import { t } from "@/lib/i18n";

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
    alternates: { canonical: `/creators/${creator.username}` },
    openGraph: { type: "profile", url: `/creators/${creator.username}`, title: `${creator.displayName} on Orochia`, description, images },
    twitter: { card: "summary", title: `${creator.displayName} on Orochia`, description },
  };
}

/** A creator's public luxury page: identity, figures, tiers, goal and published videos */
export default async function CreatorPage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const creator = await creatorByUsername(params.username.toLowerCase());
  if (!creator) notFound();
  const viewer = await getCurrentUser();
  const [videos, playlists] = await Promise.all([
    creatorVideos(creator.id),
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

      {/* Hero Panoramic Banner */}
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 dark:border-white/10 light:border-black/5 bg-gradient-to-r from-violet-950/60 via-zinc-950 to-fuchsia-950/50 dark:from-violet-950/60 dark:via-zinc-950 dark:to-fuchsia-950/50 light:from-violet-100 light:via-white light:to-pink-100 shadow-2xl">
        {creator.bannerUrl && (
          <img
            src={creator.bannerUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40 dark:opacity-40 light:opacity-25"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 dark:from-zinc-950 light:from-white via-transparent to-transparent opacity-80" />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-6 p-6 sm:p-10 z-10">
          {/* Avatar with pulsing verified ring */}
          <div className="relative h-28 w-28 sm:h-32 sm:w-32 shrink-0 overflow-hidden rounded-3xl border-2 border-violet-500/80 shadow-2xl shadow-violet-500/30">
            <img
              src={creator.avatarUrl || AVATAR_PLACEHOLDER}
              alt={creator.displayName}
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
          </div>

          <div className="text-center sm:text-left flex-1">
            <div className="flex items-center justify-center sm:justify-start gap-2.5">
              <h1 className="text-2xl sm:text-4xl font-black text-white dark:text-white light:text-slate-900 font-display">
                {creator.displayName}
              </h1>
              {creator.isCreator && creator.isVerified && <ShieldCheck className="h-6 w-6 text-violet-400" aria-label={t("profile.verified")} />}
            </div>

            <p className="text-xs text-zinc-400 dark:text-zinc-400 light:text-slate-500 font-mono mt-1">
              @{creator.username} · {creator.isCreator ? t("profile.creator") : t("profile.member")}
            </p>

            {creator.bio && (
              <p className="mt-3 max-w-2xl text-xs sm:text-sm text-zinc-300 dark:text-zinc-300 light:text-slate-600 leading-relaxed">
                {creator.bio}
              </p>
            )}

            {links.length > 0 && (
              <ul className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                {links.map((l) => (
                  <li key={l.network}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow ugc"
                      title={t("profile.visit", { network: t(`profile.networks.${l.network}`), handle: l.handle })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-violet-500/60 hover:text-white light:border-black/10 light:bg-black/5 light:text-slate-700 light:hover:text-slate-950"
                    >
                      <SocialIcon network={l.network} className="h-3.5 w-3.5" />
                      {l.network === "website" ? l.handle : `@${l.handle}`}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {/* Figures ticker */}
            <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-5 text-xs font-mono text-zinc-400 dark:text-zinc-400 light:text-slate-500">
              {stats.map(({ icon: Icon, label, value }) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-violet-400" />
                  <strong className="text-white dark:text-white light:text-slate-900">{value.toLocaleString("en-US")}</strong> {label}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="mt-5 flex flex-wrap justify-center sm:justify-start items-center gap-3">
              <RelationshipActions username={creator.username} />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Client Sections (Goal, Tiers, Categorized Media Tabs) */}
      <CreatorProfileClient
        creator={creator}
        videos={videos}
        playlists={playlists}
      />
    </div>
  );
}
