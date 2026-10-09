"use client";

import { Bookmark, CheckCircle2, Eye, Flame, Gavel, Heart, Lock, Play, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

import { TipModal } from "@/components/TipModal";
import { Avatar, Badge, Button, Card, cn, IconButton } from "@/components/ui";
import { t } from "@/lib/i18n";
import { money } from "@/lib/money";
import type { VideoVisibility } from "@/lib/visibility";

export interface VideoCardProps {
  id: string;
  title: string;
  creatorName: string;
  creatorUsername?: string;
  creatorAvatar?: string | null;
  thumbnailUrl?: string | null;
  previewAnimationUrl?: string | null;
  durationSeconds: number;
  visibility: VideoVisibility;
  minTipAmountCents: number;
  viewsCount: number;
  tipsCount: number;
  likesCount?: number;
  contentRatingId?: string | null;
  isBlurred?: boolean;
  isAdult?: boolean;
}

/** `m:ss` — the length shown on the picture. */
export const formatDuration = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

/** Badges on a picture sit on the strong veil, light text in both themes (the overlay is a `.theme-dark` island). */
const ON_MEDIA = "bg-scrim-strong normal-case tracking-normal backdrop-blur-md";

/** Stops a click on a control inside the card's link from following the link. */
const only = (fn: () => void) => (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  fn();
};

/** A video in a grid: picture (animated preview on hover), who may watch it, quick like / save, creator, counts and a tip. */
export function VideoCard(props: VideoCardProps) {
  const { id, title, creatorName, creatorUsername, creatorAvatar, viewsCount, tipsCount, minTipAmountCents } = props;
  const [hovered, setHovered] = useState(false);
  const [tipping, setTipping] = useState(false);
  const profile = creatorUsername ? `/@${creatorUsername}` : "#";

  return (
    <>
      <Card.Root interactive tone="glass" className="w-full max-w-full" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <Link href={`/watch/${id}`} className="block">
          <VideoCardMedia {...props} hovered={hovered} />
        </Link>
        <Card.Body className="justify-between gap-0">
          <div className="flex gap-3">
            <Link href={profile} className="shrink-0 transition-transform hover:scale-105">
              <Avatar src={creatorAvatar || "/avatar-placeholder.svg"} alt={creatorName} fallback={creatorName.charAt(0)} className="h-10 w-10 rounded-xl border border-border-default" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/watch/${id}`}>
                <Card.Title className="line-clamp-2 text-xs sm:text-sm">{title}</Card.Title>
              </Link>
              <div className="mt-1 flex items-center gap-1.5">
                <Link href={profile} className="truncate text-xs text-fg-secondary transition-colors hover:text-fg">
                  {creatorName}
                </Link>
                <CheckCircle2 className="h-3 w-3 shrink-0 text-success" aria-hidden />
              </div>
            </div>
          </div>
          <Card.Footer className="mt-3 justify-between pt-2.5 font-mono text-[11px] text-fg-muted">
            <VideoCardCounts viewsCount={viewsCount} tipsCount={tipsCount} />
            <Button size="sm" shape="rounded" onClick={only(() => setTipping(true))} className="h-6 gap-1 border-accent/30 bg-accent/10 px-2 text-[10px] text-accent hover:border-accent hover:bg-accent hover:text-on-accent">
              <Sparkles className="h-2.5 w-2.5" aria-hidden />
              <span>{t("card.tip")}</span>
            </Button>
          </Card.Footer>
        </Card.Body>
      </Card.Root>

      <TipModal isOpen={tipping} onClose={() => setTipping(false)} videoId={id} creatorName={creatorName} minTipAmountCents={minTipAmountCents} onUnlockedSuccess={() => setTipping(false)} />
    </>
  );
}

/** The picture: the thumbnail (the animated preview while hovered), the sensitive veil, the play hint and the badges. */
function VideoCardMedia({ hovered, thumbnailUrl, previewAnimationUrl, durationSeconds, isBlurred = false, ...video }: VideoCardProps & { hovered: boolean }) {
  const [revealed, setRevealed] = useState(!isBlurred);
  // A video still encoding has no picture yet: show the placeholder rather than a broken image.
  const [broken, setBroken] = useState(false);
  const picture = useRef<HTMLImageElement>(null);
  // The image may fail before hydration, when React is not listening yet.
  useEffect(() => {
    const img = picture.current;
    if (img?.complete && img.naturalWidth === 0) setBroken(true);
  }, []);
  const src = broken ? null : (hovered && previewAnimationUrl) || thumbnailUrl;
  const veiled = isBlurred && !revealed;

  return (
    <Card.Media>
      <Card.Image ref={picture} src={src} onError={() => setBroken(true)} fallback={<Play className="h-10 w-10" />} className={cn(veiled && "scale-110 blur-xl")} />
      {veiled && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-scrim p-4 text-center backdrop-blur-md">
          <span className="mb-1 text-[10px] font-bold uppercase tracking-wider text-accent">{t("card.sensitive")}</span>
          <Button size="sm" onClick={only(() => setRevealed(true))} className="h-7 border-0 bg-scrim-strong px-3 text-[11px] text-fg-on-media hover:bg-scrim">
            {t("card.reveal")}
          </Button>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-scrim/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/90 text-on-accent shadow-xl shadow-accent/40 backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </span>
      </div>
      <Card.Overlay corner="bottom-right">
        <Badge tone="scrim" className="rounded-sm font-mono font-medium normal-case tracking-normal">{formatDuration(durationSeconds)}</Badge>
      </Card.Overlay>
      <Card.Overlay corner="top-left" className="theme-dark flex-wrap">
        <AccessBadges {...video} />
      </Card.Overlay>
      <QuickActions />
    </Card.Media>
  );
}

/** Who may watch: 18+, the unlock price, contacts, auction, backers — or free. */
function AccessBadges({ visibility, minTipAmountCents, contentRatingId, isAdult = false }: Pick<VideoCardProps, "visibility" | "minTipAmountCents" | "contentRatingId" | "isAdult">) {
  const adult = isAdult || contentRatingId === "MATURE_18" || contentRatingId === "ADULT_EXPLICIT";
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

/** Like and save, on the picture: shown on hover with a mouse, always on touch. */
function QuickActions() {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const base = "h-8 w-8 rounded-xl backdrop-blur-md active:scale-90";
  const idle = "bg-scrim text-fg-on-media hover:bg-scrim-strong hover:text-fg-on-media";
  return (
    <Card.Overlay corner="top-right" className="transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
      <IconButton onClick={only(() => setLiked((v) => !v))} label={liked ? t("card.unlike") : t("card.like")} aria-pressed={liked} shape="rounded" className={cn(base, liked ? "bg-danger text-fg-on-media shadow-md shadow-danger/40 hover:bg-danger hover:text-fg-on-media" : idle)}>
        <Heart className={cn("h-4 w-4", liked && "fill-current")} aria-hidden />
      </IconButton>
      <IconButton onClick={only(() => setSaved((v) => !v))} label={saved ? t("card.saved") : t("card.save")} aria-pressed={saved} shape="rounded" className={cn(base, saved ? "bg-accent text-on-accent shadow-md shadow-accent/40 hover:bg-accent hover:text-on-accent" : idle)}>
        <Bookmark className={cn("h-4 w-4", saved && "fill-current")} aria-hidden />
      </IconButton>
    </Card.Overlay>
  );
}

/** Views, and tips when there are some. */
function VideoCardCounts({ viewsCount, tipsCount }: { viewsCount: number; tipsCount: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-1">
        <Eye className="h-3 w-3" aria-hidden />
        {viewsCount.toLocaleString()}
      </span>
      {tipsCount > 0 && (
        <span className="flex items-center gap-1 font-semibold text-accent">
          <Sparkles className="h-3 w-3" aria-hidden />
          {tipsCount}
        </span>
      )}
    </div>
  );
}
