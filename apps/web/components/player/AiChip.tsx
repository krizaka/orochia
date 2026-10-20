"use client";

import { Sparkles } from "lucide-react";

import { Badge, cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";

/** The seconds after the start during which the disclosure always shows, whatever the pointer does. */
const SHOWN_AT_START_SECONDS = 5;

/**
 * The AI disclosure is always there when it counts: at the start, whenever the controls show (a hover, any touch) and
 * while the video is paused. It may only rest while a video plays with the pointer away, past its first seconds.
 */
export function aiChipVisible({ isPlaying, showControls, currentTime }: { isPlaying: boolean; showControls: boolean; currentTime: number }): boolean {
  return !isPlaying || showControls || currentTime < SHOWN_AT_START_SECONDS;
}

/**
 * « AI-generated » over the picture: a quiet Krizaka UI chip (neutral scrim on the media, 8 px, no capitals), in the
 * language of the interface. It fades, never leaves the accessibility tree, and is drawn by the player — never burned into the video.
 */
export function AiChip({ visible }: { visible: boolean }) {
  const { t } = useI18n();
  return (
    <Badge
      tone="scrim"
      size="md"
      role="note"
      aria-label={t("player.ai.label")}
      data-testid="player-ai-chip"
      className={cn(
        "pointer-events-none gap-1 rounded-lg px-2 py-1 text-[11px] font-medium normal-case tracking-normal ring-1 ring-inset ring-fg-on-media/15 transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <Sparkles className="size-3 opacity-80" aria-hidden />
      {t("player.ai.chip")}
    </Badge>
  );
}
