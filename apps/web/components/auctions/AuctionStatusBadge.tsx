import { Badge, type BadgeProps } from "@/components/ui";
import { t } from "@/lib/i18n";

import type { AuctionPhase } from "./types";

const TONE: Record<AuctionPhase, BadgeProps["tone"]> = {
  UPCOMING: "neutral",
  OPEN: "accent",
  ENDING: "warning",
  AWAITING_DECISION: "warning",
  SOLD: "success",
  DECLINED: "danger",
  UNSOLD: "neutral",
  CANCELLED: "neutral",
};

/** The state of an auction as a badge (Orochia's words on the platform's Badge): it pulses while the auction is ending. */
export function AuctionStatusBadge({ phase, className }: { phase: AuctionPhase; className?: string }) {
  return (
    <Badge tone={TONE[phase]} dot pulse={phase === "ENDING"} className={className}>
      {t(`auction.phase.${phase}`)}
    </Badge>
  );
}
