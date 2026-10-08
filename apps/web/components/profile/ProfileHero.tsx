"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { AVATAR_PLACEHOLDER, useAuth } from "@/lib/auth-context";
import { SocialIcon } from "@/components/SocialIcon";
import { PictureQuickEdit } from "./PictureQuickEdit";
import { t, type MessageKey } from "@/lib/i18n";

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
    <section className="relative mb-8 overflow-visible rounded-3xl border border-white/10 bg-zinc-950/60 shadow-2xl shadow-black/40 backdrop-blur-sm light:border-black/5 light:bg-white light:shadow-xl light:shadow-violet-900/5">
      {/* Cover */}
      <div className="group relative h-36 overflow-hidden rounded-t-3xl sm:h-56">
        {banner ? (
          <img src={banner} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(120%_120%_at_0%_0%,rgba(139,92,246,0.55),transparent_55%),radial-gradient(120%_120%_at_100%_100%,rgba(236,72,153,0.45),transparent_55%)] bg-zinc-900 light:bg-violet-50" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-zinc-950/70 via-transparent to-transparent light:from-white/30" />
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
              <div className="h-28 w-28 overflow-hidden rounded-4xl bg-zinc-800 ring-4 ring-zinc-950 shadow-2xl shadow-violet-900/30 sm:h-36 sm:w-36 light:bg-slate-100 light:ring-white">
                <img src={avatar || AVATAR_PLACEHOLDER} alt={displayName} className="h-full w-full object-cover" />
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
              <h1 className="flex items-center justify-center gap-2 font-display text-2xl font-black tracking-tight text-white sm:justify-start sm:text-4xl light:text-slate-900">
                {displayName}
                {verified && <BadgeCheck className="h-6 w-6 shrink-0 text-violet-400" aria-label={t("profile.verified")} />}
              </h1>
              <p className="mt-0.5 font-mono text-xs text-zinc-400 light:text-slate-500">
                @{username}
                {roleLabel && <span className="ml-2 rounded-full bg-violet-500/15 px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-violet-300 light:text-violet-700">{roleLabel}</span>}
              </p>
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end sm:pb-1">{actions}</div>}
        </div>

        {bio && <p className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-zinc-300 sm:mx-0 sm:text-left light:text-slate-600">{bio}</p>}

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
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-violet-500/60 hover:bg-violet-500/10 hover:text-white light:border-black/10 light:bg-black/3 light:text-slate-700 hover:light:bg-violet-50 hover:light:text-slate-950"
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
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 light:text-slate-500">{s.label}</dt>
                    <dd className="font-mono text-lg font-black text-white light:text-slate-900">{s.value}</dd>
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
