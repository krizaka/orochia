import React from "react";

import { cn } from "@/components/ui";
import type { Locale } from "@/lib/locales";
import { type TourClip, tourRecording } from "@/lib/site-media";

/**
 * One real recording of the application in a window frame: the poster paints first, the clip is fetched only when
 * played (`preload="none"`), muted controls, no autoplay — so reduced motion and slow phones get the same page.
 *
 * The poster is the page's weight: the first screen's clip (`priority`) keeps it on the video and preloads it at high
 * priority (it is the LCP); every other clip draws it as a lazy picture behind a transparent video, so a poster is
 * fetched when it comes near the screen, not twelve at once.
 */
export function Clip({ clip, locale, label, frameLabel, className, priority = false }: { clip: TourClip; locale: Locale; label: string; frameLabel: string; className?: string; priority?: boolean }) {
  const media = tourRecording(clip, locale);
  return (
    <div className={cn("overflow-hidden rounded-3xl border border-border-default bg-surface-1/70 shadow-lg", className)}>
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2 font-mono text-[11px] text-fg-muted">
        <span aria-hidden className="h-2 w-2 rounded-full bg-accent" /> {frameLabel}
      </div>
      {priority ? (
        <>
          <link rel="preload" as="image" href={media.poster} fetchPriority="high" />
          <video controls playsInline muted preload="none" poster={media.poster} aria-label={label} className="aspect-video w-full bg-surface-0">
            <source src={media.webm} type="video/webm" />
            <source src={media.mp4} type="video/mp4" />
          </video>
        </>
      ) : (
        <div className="relative aspect-video w-full bg-surface-0">
          <img src={media.poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          <video controls playsInline muted preload="none" aria-label={label} className="absolute inset-0 h-full w-full bg-transparent">
            <source src={media.webm} type="video/webm" />
            <source src={media.mp4} type="video/mp4" />
          </video>
        </div>
      )}
    </div>
  );
}
