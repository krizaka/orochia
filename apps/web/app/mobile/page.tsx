import type { Metadata } from "next";
import Image from "next/image";
import React from "react";

import { PhoneClip } from "@/components/mobile/PhoneClip";
import { cn, SectionBackdrop } from "@/components/ui";
import { t } from "@/lib/i18n";
import { MOBILE_CLIPS, MOBILE_SHOTS, mobileShot } from "@/lib/mobile-media";

export const metadata: Metadata = { title: t("mobile.meta.title"), description: t("mobile.meta.description"), alternates: { canonical: "/mobile" } };

const container = "mx-auto w-full max-w-7xl px-4 sm:px-6";

/** Every recording and screenshot of the iOS and Android app, each with what it shows. */
export default function MobilePage() {
  return (
    <div className="w-full overflow-x-clip">
      <SectionBackdrop direction="up" dome={false} aria-labelledby="mobile-title">
        <div className={cn(container, "py-16 sm:py-24")}>
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-accent">{t("mobile.eyebrow")}</p>
          <h1 id="mobile-title" className="mt-2 max-w-3xl font-display text-4xl font-black tracking-tight text-fg sm:text-5xl">{t("mobile.title")}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-fg-secondary sm:text-lg">{t("mobile.lead")}</p>
          <p className="mt-4 text-xs text-fg-muted">{t("mobile.recordedOn")}</p>
        </div>
      </SectionBackdrop>

      <section className={cn(container, "py-12")} aria-labelledby="mobile-clips">
        <h2 id="mobile-clips" className="mb-8 font-display text-2xl font-black tracking-tight text-fg sm:text-3xl">{t("mobile.clipsTitle")}</h2>
        <ul className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {MOBILE_CLIPS.map((id) => (
            <li key={id}>
              <PhoneClip id={id} label={t(`mobile.clips.${id}.label`)} caption={t(`mobile.clips.${id}.caption`)} />
            </li>
          ))}
        </ul>
      </section>

      {(["ios", "android"] as const).map((platform) => (
        <section key={platform} className={cn(container, "py-12")} aria-labelledby={`mobile-${platform}`}>
          <h2 id={`mobile-${platform}`} className="mb-8 font-display text-2xl font-black tracking-tight text-fg sm:text-3xl">
            {t(`mobile.platforms.${platform}`)} · {t("mobile.shotsTitle")}
          </h2>
          <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {MOBILE_SHOTS.filter((s) => s.platform === platform).map((s) => (
              <li key={s.id}>
                <figure className="flex flex-col gap-2">
                  <Image src={mobileShot(s.id)} alt={t(`mobile.shots.${s.id}`)} width={480} height={1043} sizes="(max-width: 640px) 45vw, 20vw" unoptimized className="h-auto w-full rounded-2xl border border-border-default bg-surface-2" />
                  <figcaption className="text-xs leading-relaxed text-fg-secondary">{t(`mobile.shots.${s.id}`)}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
