import Link from "next/link";
import React from "react";

import { PhoneClip } from "@/components/mobile/PhoneClip";
import { buttonVariants, cn, SectionBackdrop } from "@/components/ui";
import { t } from "@/lib/i18n";
import { MOBILE_CLIPS } from "@/lib/mobile-media";

/** The app on a phone, on the home page: a swipeable row of its recordings, then the way to every clip and screenshot. */
export function MobileSection() {
  return (
    <SectionBackdrop direction="up" dome={false} aria-labelledby="home-mobile" id="mobile">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-accent">{t("mobile.eyebrow")}</p>
        <h2 id="home-mobile" className="mt-2 max-w-3xl font-display text-3xl font-black tracking-tight text-fg sm:text-4xl">{t("mobile.title")}</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-secondary">{t("mobile.lead")}</p>
        <ul tabIndex={0} aria-label={t("mobile.clipsTitle")} className="-mx-4 mt-8 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          {MOBILE_CLIPS.slice(0, 4).map((id) => (
            <li key={id} className="w-[70vw] max-w-[15rem] shrink-0 snap-center sm:w-[15rem] lg:w-auto lg:max-w-none">
              <PhoneClip id={id} label={t(`mobile.clips.${id}.label`)} caption={t(`mobile.clips.${id}.caption`)} />
            </li>
          ))}
        </ul>
        <p className="mt-8">
          <Link href="/mobile" className={cn(buttonVariants({ variant: "outline", size: "lg", shape: "pill" }))}>
            {t("mobile.all")}
          </Link>
        </p>
      </div>
    </SectionBackdrop>
  );
}
