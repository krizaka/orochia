"use client";

import { BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { Avatar, Badge, SocialIcon } from "@/components/ui";
import { AVATAR_PLACEHOLDER, useAuth } from "@/lib/auth-context";
import { type MessageKey,t } from "@/lib/i18n";

import { PictureQuickEdit } from "./PictureQuickEdit";

export interface HeroLink {
  network: string;
  handle: string;
  url: string;
}

/**
 * The top of a profile — the public page and the owner's dashboard share it: cover image, avatar overlapping it,
 * name, handle, bio, links, figures and actions. On your own profile the cover and the photo are edited in place
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
  const router = useRouter();
  const { refresh } = useAuth();
  const [avatar, setAvatar] = useState(avatarUrl);
  const [banner, setBanner] = useState(bannerUrl);
  const changed = () => {
    void refresh();
    router.refresh();
  };

  return (
    <section className="relative mb-8 overflow-visible rounded-3xl border border-border-default bg-surface-1/60 shadow-2xl shadow-accent/5 backdrop-blur-sm">
      {/* Cover */}
      <div className="group relative h-36 overflow-hidden rounded-t-3xl sm:h-56">
        {banner ? (
          <img src={banner} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(120%_120%_at_0%_0%,rgba(139,92,246,0.55),transparent_55%),radial-gradient(120%_120%_at_100%_100%,rgba(236,72,153,0.45),transparent_55%)] bg-surface-2" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-surface-0/70 via-transparent to-transparent" />
        {editable && (
          <PictureQuickEdit
            kind="banner"
            hasPicture={Boolean(banner)}
            className="absolute right-3 top-3 sm:right-4 sm:top-4"
            onChanged={(url) => {
              setBanner(url);
              changed();
            }}
          />
        )}
      </div>

      <div className="relative px-5 pb-6 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-end sm:gap-5">
            {/* Avatar, overlapping the cover */}
            <div className="group relative -mt-14 shrink-0 sm:-mt-20">
              <div className="h-28 w-28 overflow-hidden rounded-4xl bg-surface-3 ring-4 ring-border-subtle shadow-2xl shadow-accent/30 sm:h-36 sm:w-36">
                <Avatar src={avatar || AVATAR_PLACEHOLDER} alt={displayName} fallback={displayName.charAt(0)} className="h-full w-full rounded-none text-3xl" />
              </div>
              {editable && (
                <PictureQuickEdit
                  kind="avatar"
                  hasPicture={Boolean(avatar)}
                  className="absolute -bottom-1 -right-1"
                  onChanged={(url) => {
                    setAvatar(url);
                    changed();
                  }}
                />
              )}
            </div>
            <div className="text-center sm:pb-1 sm:text-left">
              <h1 className="flex items-center justify-center gap-2 font-display text-2xl font-black tracking-tight text-fg sm:justify-start sm:text-4xl">
                {displayName}
                {verified && <BadgeCheck className="h-6 w-6 shrink-0 text-accent" aria-label={t("profile.verified")} />}
              </h1>
              <p className="mt-0.5 font-mono text-xs text-fg-secondary">
                @{username}
                {roleLabel && <Badge size="sm" tone="accent" className="ml-2 font-sans font-bold">{roleLabel}</Badge>}
              </p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end sm:pb-1">{actions}</div>}
        </div>

        {bio && <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-fg-secondary sm:mx-0 sm:text-left">{bio}</p>}

        {(links.length > 0 || stats.length > 0) && (
          <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <ul className="flex flex-wrap justify-center gap-2 sm:justify-start">
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
              <dl className="flex gap-6 text-center">
                {stats.map((s) => (
                  <div key={s.label}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">{s.label}</dt>
                    <dd className="font-mono text-lg font-black text-fg">{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
