"use client";

import { Download, Gavel, Play, Trophy } from "lucide-react";
import Link from "next/link";

import { Avatar, Badge, Card, Countdown } from "@/components/ui";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { money } from "@/lib/money";

import { auctionCountdown, auctionPrice } from "./auction-presenter";
import { AuctionStatusBadge } from "./AuctionStatusBadge";
import type { AuctionCard as AuctionCardView } from "./types";

/** An auction in a list: picture, state, price, countdown, creator — the whole card opens its watch page. */
export function AuctionCard({ auction: a, index = 0 }: { auction: AuctionCardView; index?: number }) {
  const price = auctionPrice(a);
  const countdown = auctionCountdown(a);
  return (
    <Card.Root asChild interactive tone="glass" reveal={index}>
      <Link href={`/watch/${a.videoId}#auction`}>
        <Card.Media>
          <Card.Image src={a.thumbnailUrl} fallback={<Gavel className="h-10 w-10" />} />
          <Card.Overlay corner="top-left" className="theme-dark">
            <AuctionStatusBadge phase={a.phase} className="bg-scrim-strong backdrop-blur-md" />
            {a.leading && (
              <Badge tone="success" size="md" className="bg-scrim-strong backdrop-blur-md">
                <Trophy className="h-3 w-3" aria-hidden /> {t(a.phase === "SOLD" ? "auction.phase.SOLD" : "auction.leading")}
              </Badge>
            )}
          </Card.Overlay>
          <Card.Overlay corner="bottom-right">
            <Badge tone="scrim" className="normal-case tracking-normal">
              {a.rights === "DOWNLOAD" ? <Download className="h-3 w-3" aria-hidden /> : <Play className="h-3 w-3" aria-hidden />}
              {t(`auction.rights.${a.rights}`)}
            </Badge>
          </Card.Overlay>
        </Card.Media>
        <Card.Body>
          <Card.Title>{a.title}</Card.Title>
          <div className="flex items-end justify-between gap-3">
            <Card.Stat label={t(price.labelKey)}>{money(price.cents)}</Card.Stat>
            {countdown && <Countdown size="sm" label={t(countdown.labelKey)} target={countdown.target} />}
          </div>
          <Card.Footer>
            <Avatar src={a.creatorAvatar || AVATAR_PLACEHOLDER} size="xs" fallback={a.creatorName.charAt(0)} />
            <span className="min-w-0 flex-1 truncate">{a.creatorName}</span>
            <span className="shrink-0 tabular-nums">{t("auction.bids", { count: a.bidsCount })}</span>
          </Card.Footer>
        </Card.Body>
      </Link>
    </Card.Root>
  );
}
