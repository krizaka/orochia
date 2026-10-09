"use client";

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { VideoPlayer } from "@/components/VideoPlayer";
import { TipModal } from "@/components/TipModal";
import { ReportModal } from "@/components/ReportModal";
import { RelationshipActions } from "@/components/RelationshipActions";
import { SaveToPlaylist } from "@/components/SaveToPlaylist";
import { VideoComments } from "@/components/VideoComments";
import { AuctionPanel } from "@/components/auctions/AuctionPanel";
import { useAuctionStream } from "@/components/auctions/useAuctionStream";
import { AVATAR_PLACEHOLDER, useAuth } from "@/lib/auth-context";
import { Sparkles, Eye, ShieldCheck, Share2, Flag, CheckCircle2, Heart, MessageSquare, Gavel } from "lucide-react";
import { Avatar, Button, buttonVariants, cn, orochiaButton, Skeleton } from "@/components/ui";
import { t } from "@/lib/i18n";

interface StreamAccess {
  allowed: boolean;
  streamUrl?: string;
  reason?: string;
  minTipAmountCents?: number;
}

interface RelatedVideo {
  id: string;
  title: string;
  creatorName: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  visibility: string;
}

interface VideoDetails {
  id: string;
  title: string;
  description: string | null;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar: string | null;
  creatorBio: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number;
  visibility: string;
  minTipAmountCents: number;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  commentsEnabled: boolean;
  createdAt: string;
  moreFromCreator: RelatedVideo[];
}

// The auction panel sits beside the player on large screens and right under it on phones (mounted once, in one place).
const LARGE = "(min-width: 1024px)";
const subscribeLarge = (cb: () => void) => {
  const query = window.matchMedia(LARGE);
  query.addEventListener("change", cb);
  return () => query.removeEventListener("change", cb);
};
const useLargeScreen = () => useSyncExternalStore(subscribeLarge, () => window.matchMedia(LARGE).matches, () => false);

const formatDuration = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

export default function WatchClient() {
  const { id: videoId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const paymentState = searchParams.get("payment");

  const [details, setDetails] = useState<VideoDetails | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [stream, setStream] = useState<StreamAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const { user } = useAuth();
  const auctionState = useAuctionStream(`/api/videos/${videoId}/auction`);
  const large = useLargeScreen();

  const fetchStreamAccess = useCallback(async () => {
    try {
      const res = await fetch(`/api/videos/${videoId}/stream`, { cache: "no-store" });
      setStream((await res.json()) as StreamAccess);
    } catch {
      setStream({ allowed: false });
    }
  }, [videoId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const res = await fetch(`/api/videos/${videoId}/details`, { cache: "no-store" });
      if (cancelled) return;
      if (res.status === 404) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      const data = (await res.json()) as { video?: VideoDetails; liked?: boolean };
      setDetails(data.video ?? null);
      setLiked(Boolean(data.liked));
      await fetchStreamAccess();
      if (!cancelled) setIsLoading(false);
    })().catch(() => setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [videoId, fetchStreamAccess]);

  // Back from the gateway: the webhook may land a few seconds after the redirect.
  useEffect(() => {
    if (paymentState !== "success") return;
    const timer = setInterval(() => void fetchStreamAccess(), 3000);
    const stop = setTimeout(() => clearInterval(timer), 30000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [paymentState, fetchStreamAccess]);

  // Winning the auction opens the player at once.
  const won = auctionState.auction?.viewer.won ?? false;
  useEffect(() => {
    if (won) void fetchStreamAccess();
  }, [won, fetchStreamAccess]);

  // A share is counted once the link was handed over; the link still enforces the video's access.
  const share = async () => {
    const url = window.location.href.split("?")[0];
    try {
      if (navigator.share) await navigator.share({ title: details?.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      void fetch(`/api/videos/${videoId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "LINK" }),
      });
    } catch {
      /* dismissed */
    }
  };

  const toggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    const res = await fetch(`/api/videos/${videoId}/like`, { method: liked ? "DELETE" : "POST" });
    if (res.ok) {
      const data = (await res.json()) as { liked: boolean; likesCount: number };
      setLiked(data.liked);
      setDetails((d) => (d ? { ...d, likesCount: data.likesCount } : d));
    }
    setLikeBusy(false);
  };

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-fg">{t("watch.notFound")}</h1>
        <p className="mt-2 text-sm text-fg-secondary">{t("watch.notFoundBody")}</p>
        <Link href="/" className={orochiaButton({ variant: "sensual", shape: "pill", className: "mt-6" })}>
          {t("watch.backToFeed")}
        </Link>
      </div>
    );
  }

  const title = details?.title ?? "";
  const minTipAmountCents = stream?.minTipAmountCents ?? details?.minTipAmountCents ?? 0;
  const isPaywalled = stream ? !stream.allowed && stream.reason === "PAYWALL_REQUIRED" : false;
  const isContactsOnly = stream ? !stream.allowed && stream.reason === "CONTACTS_ONLY" : false;
  const isFollowersOnly = stream ? !stream.allowed && stream.reason === "FOLLOWERS_ONLY" : false;
  const isInvitedOnly = stream ? !stream.allowed && stream.reason === "INVITED_ONLY" : false;
  const isAuction = stream ? !stream.allowed && stream.reason === "AUCTION" : false;
  const isChallenge = stream ? !stream.allowed && stream.reason === "CHALLENGE" : false;
  const auctionPanel = auctionState.auction && (
    <AuctionPanel auction={auctionState.auction} skewMs={auctionState.skewMs} pulse={auctionState.pulse} onChanged={() => void auctionState.reload()} onOwnBid={auctionState.onOwnBid} />
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {paymentState === "success" && !stream?.allowed && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-xs text-success">
          <CheckCircle2 className="h-4 w-4" />
          {t("watch.paymentReceived")}
        </div>
      )}
      {paymentState === "cancelled" && (
        <div className="mb-6 rounded-2xl border border-border-default bg-surface-2/60 px-4 py-3 text-xs text-fg-secondary">
          {t("watch.paymentCancelled")}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {isLoading || !details ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border-subtle" aria-busy="true">
              <Skeleton shape="rect" className="absolute inset-0 h-full rounded-2xl" />
              <span className="absolute inset-0 flex items-center justify-center font-mono text-xs text-fg-muted">{t("watch.verifying")}</span>
            </div>
          ) : (
            <VideoPlayer
              videoId={videoId}
              streamUrl={stream?.streamUrl}
              posterUrl={details.thumbnailUrl ?? undefined}
              title={title}
              isPaywalled={isPaywalled}
              minTipAmountCents={minTipAmountCents}
              isContactsOnly={isContactsOnly}
              isFollowersOnly={isFollowersOnly}
              isInvitedOnly={isInvitedOnly}
              isAuction={isAuction}
              isChallenge={isChallenge}
              gateAction={
                isChallenge ? (
                  <Link href="/challenges" className={orochiaButton({ variant: "sensual", shape: "rounded" })}>
                    {t("player.challengeCta")}
                  </Link>
                ) : isAuction ? (
                  <a href="#auction" className={orochiaButton({ variant: "sensual", shape: "rounded" })}>
                    <Gavel className="h-4 w-4" /> {t("player.auctionCta")}
                  </a>
                ) : (
                <RelationshipActions
                  username={details.creatorUsername}
                  show={isFollowersOnly ? ["follow"] : ["contact"]}
                  onChange={() => void fetchStreamAccess()}
                />
                )
              }
              onUnlockRequested={() => setIsTipModalOpen(true)}
            />
          )}

          {!large && auctionPanel && <div className="mt-6">{auctionPanel}</div>}

          {details && (
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-xl sm:text-2xl font-bold text-fg">{title}</h1>
                <div className="flex items-center gap-3">
                  <Button variant="sensual" size="sm" shape="rounded" onClick={() => setIsTipModalOpen(true)}>
                    <Sparkles className="h-4 w-4" aria-hidden />
                    <span>{isPaywalled ? t("watch.unlock") : t("watch.tip")}</span>
                  </Button>
                  {stream?.allowed &&
                    (user ? (
                      <Button
                        size="sm"
                        shape="rounded"
                        onClick={toggleLike}
                        disabled={likeBusy}
                        aria-pressed={liked}
                        aria-label={liked ? t("watch.unlike") : t("watch.like")}
                        className={cn(liked && "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15")}
                      >
                        <Heart className={cn("h-4 w-4", liked && "fill-current")} aria-hidden />
                        <span>{details.likesCount.toLocaleString("en-US")}</span>
                      </Button>
                    ) : (
                      <Link href={`/auth/login?next=/watch/${videoId}`} aria-label={t("watch.like")} className={buttonVariants({ size: "sm", shape: "rounded" })}>
                        <Heart className="h-4 w-4" />
                        <span>{details.likesCount.toLocaleString("en-US")}</span>
                      </Link>
                    ))}
                  <SaveToPlaylist videoId={videoId} />
                  <Button size="sm" shape="rounded" onClick={share}>
                    <Share2 className="h-4 w-4" aria-hidden />
                    <span>{copied ? t("watch.copied") : t("watch.share")}</span>
                  </Button>
                  <Button size="sm" shape="rounded" onClick={() => setIsReportModalOpen(true)} className="hover:border-danger/40 hover:bg-danger/10 hover:text-danger">
                    <Flag className="h-3.5 w-3.5" aria-hidden />
                    <span>{t("watch.report")}</span>
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-fg-secondary font-mono">
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5 text-fg-muted" />
                  {t("watch.views", { count: details.viewsCount.toLocaleString("en-US") })}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5 text-fg-muted" aria-hidden />
                  <span aria-label={t("watch.comments", { count: details.commentsCount })}>{details.commentsCount.toLocaleString("en-US")}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Share2 className="h-3.5 w-3.5 text-fg-muted" aria-hidden />
                  <span aria-label={t("watch.shares", { count: details.sharesCount })}>{details.sharesCount.toLocaleString("en-US")}</span>
                </span>
                <span>•</span>
                <span>{formatDuration(details.durationSeconds)}</span>
                <span>•</span>
                <span>
                  {new Date(details.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>

              <div className="mt-6 flex items-center justify-between rounded-2xl border border-border-subtle bg-surface-2/60 p-4 shadow-xs">
                <div className="flex items-center gap-3">
                  <Avatar src={details.creatorAvatar || AVATAR_PLACEHOLDER} alt={details.creatorName} fallback={details.creatorName.charAt(0)} className="h-12 w-12 border border-accent/30" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-fg">{details.creatorName}</span>
                      <ShieldCheck className="h-4 w-4 text-accent" aria-label={t("watch.verified")} />
                    </div>
                    <span className="text-xs text-fg-secondary">@{details.creatorUsername}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <RelationshipActions username={details.creatorUsername} show={["follow"]} size="sm" onChange={() => void fetchStreamAccess()} />
                  <Link href={`/@${details.creatorUsername}`} className={buttonVariants({ size: "sm", shape: "rounded" })}>
                    {t("watch.viewProfile")}
                  </Link>
                </div>
              </div>

              {(details.description || details.creatorBio) && (
                <p className="mt-4 text-sm text-fg-secondary leading-relaxed bg-surface-2/30 rounded-2xl p-4 border border-border-subtle whitespace-pre-line shadow-xs">
                  {details.description || details.creatorBio}
                </p>
              )}

              {stream?.allowed && (
                <VideoComments
                  videoId={videoId}
                  isCreator={user?.username === details.creatorUsername}
                  commentsEnabled={details.commentsEnabled}
                  onCountChange={(delta) => setDetails((d) => (d ? { ...d, commentsCount: Math.max(0, d.commentsCount + delta) } : d))}
                />
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {large && auctionPanel}
          <div className="rounded-2xl border border-border-default bg-surface-2/50 p-5 shadow-xs">
            <h3 className="text-sm font-bold text-fg mb-3">{t("watch.protection.title")}</h3>
            <ul className="space-y-2.5 text-xs text-fg-secondary">
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                <span>{t("watch.protection.signed")}</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                <span>{t("watch.protection.checked")}</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                <span>{t("watch.protection.confirmed")}</span>
              </li>
            </ul>
          </div>

          {details && details.moreFromCreator.length > 0 && (
            <div className="rounded-2xl border border-border-subtle bg-surface-2/30 p-5 shadow-xs">
              <h3 className="text-sm font-bold text-fg mb-3">{t("watch.more", { name: details.creatorName })}</h3>
              <div className="space-y-3">
                {details.moreFromCreator.map((video) => (
                  <Link key={video.id} href={`/watch/${video.id}`} className="flex gap-3 items-center group">
                    <div className="h-16 w-24 rounded-lg bg-surface-3 overflow-hidden shrink-0">
                      {video.thumbnailUrl && (
                        <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-fg group-hover:text-accent line-clamp-1">{video.title}</h4>
                      <span className="block text-[10px] text-fg-muted font-mono">
                        {formatDuration(video.durationSeconds)} • {video.visibility === "PUBLIC" ? t("watch.free") : t("watch.members")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {details && (
        <>
          <TipModal
            isOpen={isTipModalOpen}
            onClose={() => setIsTipModalOpen(false)}
            videoId={videoId}
            creatorName={details.creatorName}
            minTipAmountCents={Math.max(minTipAmountCents, 100)}
            onUnlockedSuccess={() => void fetchStreamAccess()}
          />
          <ReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            videoId={videoId}
            videoTitle={title}
          />
        </>
      )}
    </div>
  );
}
