"use client";

import { VideoCard as KitVideoCard } from "@krizaka/ui/media-grid";
import { Flame, Gavel, Lock, Play, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { TipModal } from "@/components/TipModal";
import { Badge, Button, cn } from "@/components/ui";
import { isAdultRating } from "@/lib/content-ratings";
import { t } from "@/lib/i18n";
import { money } from "@/lib/money";
import { defaultAvatarFor } from "@/lib/presets";
import { frameOf, tileFitOf } from "@/lib/video-aspect";
import { qualityOf } from "@/lib/video-quality";
import type { VideoVisibility } from "@/lib/visibility";

export interface VideoCardProps {
  id: string;
  title: string;
  creatorName: string;
  creatorUsername?: string;
  creatorAvatar?: string | null;
  thumbnailUrl?: string | null;
  previewAnimationUrl?: string | null;
  /** The renditions Bunny encoded: the badge shows the best one (lib/video-quality.ts). */
  resolutions?: string[] | null;
  /** The source picture's size: a vertical clip fills a vertical box, a horizontal one 16:9 (lib/video-aspect.ts). */
  width?: number | null;
  height?: number | null;
  durationSeconds: number;
  visibility: VideoVisibility;
  minTipAmountCents: number;
  viewsCount: number;
  tipsCount: number;
  likesCount?: number;
  contentRatingId?: string | null;
  isBlurred?: boolean;
  isAdult?: boolean;
  /** Shown as chips that open `/explore?tag=…` (Explore passes them; at most three are shown). */
  tags?: string[];
  /** One of the first cards of a page (the largest contentful paint): its poster loads at once and first. The others are lazy. */
  priority?: boolean;
  /** In a search: found by its meaning rather than its words (the Explorer, lib/explore-semantic.ts). */
  via?: "text" | "meaning" | "both";
}

/** `m:ss` — the length shown on the picture. */
export const formatDuration = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

/** Badges on a picture sit on the strong veil, light text in both themes (the overlay is a `.theme-dark` island). */
const ON_MEDIA = "bg-scrim-strong normal-case tracking-normal backdrop-blur-md";

/**
 * A video in a grid or on the Shorts shelf: the kit's aspect-aware `VideoCard` (one body height, one stretched link),
 * with Orochia's own parts in its slots — who may watch it, the sensitive veil, a tip.
 */
export function VideoCard({ aspect, layout, ...props }: VideoCardProps & { aspect?: "portrait" | "landscape"; layout?: "stack" | "row" }) {
  const { id, title, creatorName, creatorUsername, creatorAvatar, thumbnailUrl, previewAnimationUrl, width, height, durationSeconds, viewsCount, minTipAmountCents, isBlurred = false } = props;
  const [tipping, setTipping] = useState(false);
  const [revealed, setRevealed] = useState(!isBlurred);
  const frame = aspect ?? frameOf(width, height, durationSeconds);
  return (
    <>
      <KitVideoCard
        href={`/watch/${id}`}
        linkAs={Link}
        title={title}
        aspect={frame}
        layout={layout}
        poster={thumbnailUrl}
        loading={props.priority ? "eager" : "lazy"}
        posterPriority={props.priority ? "high" : "auto"}
        previewSrc={previewAnimationUrl}
        fit={tileFitOf(width, height, frame)}
        duration={formatDuration(durationSeconds)}
        badges={<><AccessBadges {...props} /><QualityBadge resolutions={props.resolutions} width={width} height={height} /></>}
        blurred={isBlurred && !revealed}
        overlay={
          isBlurred && !revealed ? (
            <div className="flex w-full flex-col items-center justify-center bg-scrim p-3 text-center backdrop-blur-md">
              <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-fg-accent">{t("card.sensitive")}</span>
              <Button size="sm" onClick={() => setRevealed(true)} className="h-7 border-0 bg-scrim-strong px-3 text-[11px] text-fg-on-media hover:bg-scrim">
                {t("card.reveal")}
              </Button>
            </div>
          ) : null
        }
        fallback={<Play className="h-10 w-10" />}
        creator={{
          name: creatorName,
          avatarSrc: creatorAvatar ?? defaultAvatarFor(creatorName),
          href: creatorUsername ? `/@${creatorUsername}` : undefined,
          defaultAvatar: { brand: "orochia", seed: creatorName },
        }}
        meta={t("feed.views", { count: viewsCount.toLocaleString("en-US") })}
        action={
          <Button size="sm" shape="rounded" onClick={() => setTipping(true)} className="h-6 gap-1 border-accent/30 bg-accent/10 px-2 text-[10px] text-fg-accent hover:border-accent hover:bg-accent hover:text-on-accent">
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            <span>{t("card.tip")}</span>
          </Button>
        }
      />
      <TipModal isOpen={tipping} onClose={() => setTipping(false)} videoId={id} creatorName={creatorName} minTipAmountCents={minTipAmountCents} onUnlockedSuccess={() => setTipping(false)} />
    </>
  );
}

/** The real encoded quality (SD / HD / 2K / 4K and the lines), nothing while the video is not encoded. */
function QualityBadge({ resolutions, width, height }: { resolutions?: string[] | null; width?: number | null; height?: number | null }) {
  const q = qualityOf(resolutions, width, height);
  if (!q) return null;
  return (
    <Badge size="sm" tone="neutral" className={cn(ON_MEDIA, "font-mono")} data-quality={q.tier} title={t("quality.title", { label: q.label })}>
      {q.label}
    </Badge>
  );
}

/** Who may watch: 18+, the unlock price, contacts, auction, backers — or free. */
function AccessBadges({ visibility, minTipAmountCents, contentRatingId, isAdult = false }: Pick<VideoCardProps, "visibility" | "minTipAmountCents" | "contentRatingId" | "isAdult">) {
  const adult = isAdult || isAdultRating(contentRatingId);
  const ACCESS = {
    TIPPED_UNLOCKED: { icon: Lock, label: t("card.unlockFor", { price: money(minTipAmountCents) }) },
    CONTACTS_ONLY: { icon: Users, label: t("card.contacts") },
    AUCTION: { icon: Gavel, label: t("card.auction") },
    CHALLENGE: { icon: Flame, label: t("card.challenge") },
  } as Partial<Record<VideoVisibility, { icon: React.ElementType; label: string }>>;
  const access = ACCESS[visibility];
  return (
    <>
      {adult && (
        <Badge size="sm" tone="danger" className={cn(ON_MEDIA, "font-mono font-black")}>
          {t("card.adult")}
        </Badge>
      )}
      {access ? (
        <Badge size="md" tone="accent" className={cn(ON_MEDIA, "font-bold")}>
          <access.icon className="h-3 w-3" aria-hidden /> {access.label}
        </Badge>
      ) : (
        <Badge size="sm" tone="success" className={ON_MEDIA}>
          {t("card.free")}
        </Badge>
      )}
    </>
  );
}
