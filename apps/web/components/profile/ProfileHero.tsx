"use client";

import { BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { ProfileStoriesRow, StoryAvatarRing } from "@/components/stories/ProfileStories";
import { Avatar, Badge, SocialIcon } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { type MessageKey } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n-client";
import { defaultAvatarFor, defaultBannerFor, safeImageSrc } from "@/lib/presets";

import { PictureQuickEdit } from "./PictureQuickEdit";

export interface HeroLink {
  network: string;
  handle: string;
  url: string;
}

/**
 * The top of a public profile — light and compact, media comes next: a slim cover, the avatar overlapping it,
 * name, handle, bio, links, figures and actions, no box around them. On your own profile the cover and the photo are edited in place
 * (hover on a computer, always visible on a phone): quick actions, no settings page needed.
 */
export function ProfileHero({
  displayName,
  username,
  avatarUrl,
  bannerUrl,
  verified = false,
  roleLabel,
  bio,
  links = [],
  stats = [],
  actions,
  editable = false,
}: {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  verified?: boolean;
  roleLabel?: string;
  bio?: string | null;
  links?: HeroLink[];
  stats?: { label: string; value: string }[];
  actions?: React.ReactNode;
  editable?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { refresh } = useAuth();
  const [avatar, setAvatar] = useState(avatarUrl);
  const [banner, setBanner] = useState(bannerUrl);
  const changed = () => {
    void refresh();
    router.refresh();
  };

  return (
    <section className="relative mb-6">
      {/* Cover */}
      <div className="group relative h-28 overflow-hidden rounded-2xl sm:h-44">
        <img src={safeImageSrc(banner) ?? defaultBannerFor(displayName)} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-surface-0/70 via-transparent to-transparent" />
        {editable && (
          <PictureQuickEdit
            kind="banner"
            hasPicture={Boolean(banner)}
            current={banner}
            className="absolute right-3 top-3 sm:right-4 sm:top-4"
            onChanged={(url) => {
              setBanner(url);
              changed();
            }}
          />
        )}
      </div>

      <div className="relative px-1 sm:px-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            {/* Avatar, overlapping the cover */}
            <div className="group relative -mt-10 shrink-0 sm:-mt-14">
              {/* Inside a ProfileStories (the public page), the picture carries the story ring and opens the stories. */}
              <StoryAvatarRing>
                <div className="h-20 w-20 overflow-hidden rounded-3xl bg-surface-3 ring-4 ring-surface-0 sm:h-28 sm:w-28">
                  <Avatar src={avatar} defaultAvatar={{ brand: "orochia", seed: displayName }} fallbackSrc={defaultAvatarFor(displayName)} alt={displayName} fallback={displayName.charAt(0)} className="h-full w-full rounded-none text-3xl" />
                </div>
              </StoryAvatarRing>
              {editable && (
                <PictureQuickEdit
                  kind="avatar"
                  hasPicture={Boolean(avatar)}
                  current={avatar}
                  className="absolute -bottom-1 -right-1"
                  onChanged={(url) => {
                    setAvatar(url);
                    changed();
                  }}
                />
              )}
            </div>
            <div className="min-w-0 pb-1">
              <h1 className="flex items-center gap-2 font-display text-xl font-black tracking-tight text-fg sm:text-3xl">
                {displayName}
                {verified && <BadgeCheck className="h-6 w-6 shrink-0 text-fg-accent" aria-label={t("profile.verified")} />}
              </h1>
              <p className="mt-0.5 font-mono text-xs text-fg-secondary">
                @{username}
                {roleLabel && <Badge size="sm" tone="accent" className="ml-2 font-sans font-bold">{roleLabel}</Badge>}
              </p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:pb-1">{actions}</div>}
        </div>

        {bio && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-secondary">{bio}</p>}

        {(links.length > 0 || stats.length > 0) && (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <ul className="flex flex-wrap gap-2">
              {links.map((l) => (
                <li key={l.network}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    title={t("profile.visit", { network: t(`profile.networks.${l.network}` as MessageKey), handle: l.handle })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-2 px-3 py-1.5 text-xs font-semibold text-fg transition-colors hover:border-accent/60 hover:bg-accent/10 hover:text-fg"
                  >
                    <SocialIcon network={l.network} className="h-3.5 w-3.5" />
                    {l.network === "website" ? l.handle : `@${l.handle}`}
                  </a>
                </li>
              ))}
            </ul>
            {stats.length > 0 && (
              <dl className="flex gap-6">
                {stats.map((s) => (
                  <div key={s.label}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">{s.label}</dt>
                    <dd className="font-mono text-base font-black text-fg">{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
        <ProfileStoriesRow />
      </div>
    </section>
  );
}
