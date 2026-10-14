import type { Metadata } from "next";
import React from "react";

import { MobileStepCard } from "@/components/mobile/MobileStepCard";
import { cn, SectionBackdrop } from "@/components/ui";
import { t } from "@/lib/i18n";
import { MOBILE_STEPS } from "@/lib/mobile-media";

export const metadata: Metadata = { title: t("mobile.meta.title"), description: t("mobile.meta.description"), alternates: { canonical: "/mobile" } };

const container = "mx-auto w-full max-w-7xl px-4 sm:px-6";

/** The four steps of the Orochia app, each explained. */
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

      <section className={cn(container, "py-12")} aria-labelledby="mobile-steps">
        <h2 id="mobile-steps" className="sr-only">{t("mobile.stepsTitle")}</h2>
        <ol className="space-y-20">
          {MOBILE_STEPS.map((id, i) => (
            <MobileStepCard key={id} id={id} index={i} />
          ))}
        </ol>
      </section>
    </div>
  );
}
