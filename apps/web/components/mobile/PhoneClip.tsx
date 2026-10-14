import React from "react";

import { type MobileClip,mobileClip } from "@/lib/mobile-media";

/**
 * One recording of the app in a phone frame, played in place on demand: the poster paints first, the clip is fetched
 * only when played (`preload="none"`) and never autoplays — which is also what reduced motion asks. The caption says
 * what happens; nothing here is mocked.
 */
export function PhoneClip({ id, label, caption }: { id: MobileClip; label: string; caption: string }) {
  const c = mobileClip(id);
  return (
    <figure className="flex w-full min-w-0 flex-col gap-3">
      <div className="mx-auto w-full max-w-[15rem] overflow-hidden rounded-[2rem] border-[6px] border-border-default bg-surface-2 shadow-lg">
        <video controls playsInline preload="none" poster={c.poster} aria-label={`${label}. ${caption}`} className="block aspect-[720/1566] w-full bg-surface-0 object-cover">
          <source src={c.webm} type="video/webm" />
          <source src={c.mp4} type="video/mp4" />
        </video>
      </div>
      <figcaption className="space-y-1 text-center">
        <span className="block text-xs font-bold uppercase tracking-wider text-fg-accent">{label}</span>
        <span className="block text-sm leading-relaxed text-fg-secondary">{caption}</span>
      </figcaption>
    </figure>
  );
}
