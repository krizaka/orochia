import React from "react";

import { mobileClip,type MobileStep } from "@/lib/mobile-media";

/**
 * One recording of the app in a phone frame, played in place on demand: the poster paints first, the clip is fetched
 * only when played (`preload="none"`) and never autoplays — which is also what reduced motion asks. `alt` is the text
 * alternative of the recording; the caption under it is optional (a step explains itself beside the phone).
 */
export function PhoneClip({ id, label, alt, caption }: { id: MobileStep; label: string; alt: string; caption?: string }) {
  const c = mobileClip(id);
  return (
    <figure className="flex w-full min-w-0 flex-col gap-3">
      <div className="mx-auto w-full max-w-[15rem] overflow-hidden rounded-[2rem] border-[6px] border-border-default bg-surface-2 shadow-lg">
        <video controls playsInline preload="none" poster={c.poster} aria-label={`${label}. ${alt}`} className="block aspect-[720/1566] w-full bg-surface-0 object-cover">
          <source src={c.webm} type="video/webm" />
          <source src={c.mp4} type="video/mp4" />
        </video>
      </div>
      {caption && (
        <figcaption className="space-y-1 text-center">
          <span className="block text-xs font-bold text-fg-accent">{label}</span>
          <span className="block text-sm leading-relaxed text-fg-secondary">{caption}</span>
        </figcaption>
      )}
    </figure>
  );
}
