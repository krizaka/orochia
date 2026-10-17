import { platformFeePercent } from "@orochia/payments";
import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

import { Clip } from "@/components/how-it-works/Clip";
import { Journey } from "@/components/how-it-works/Journey";
import { Ways } from "@/components/how-it-works/Ways";
import { Button, buttonVariants, cn, SectionBackdrop } from "@/components/ui";
import { getI18n, localeFromParams } from "@/lib/i18n-server";

const share = () => 100 - platformFeePercent();

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await localeFromParams(params);
  const { t } = await getI18n();
  return { title: t("howItWorks.meta.title"), description: t("howItWorks.meta.description", { share: share() }) };
}

const container = "mx-auto w-full max-w-7xl px-4 sm:px-6";
const h2 = "font-display text-2xl font-black tracking-tight text-fg sm:text-3xl";

/**
 * What Orochia is, in four short sections: the promise with the real app playing, the journey in seven steps, the four
 * ways to pay a creator, and the way in. The 90 % is computed from the platform fee setting, never typed.
 */
export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  await localeFromParams(params);
  const { t, locale } = await getI18n();
  const s = share();
  return (
    <div className="w-full overflow-x-clip">
      <SectionBackdrop direction="up" dome={false} aria-labelledby="how-title">
        <div className={cn(container, "grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2")}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-fg-accent">{t("howItWorks.eyebrow")}</p>
            <h1 id="how-title" className="mt-2 font-display text-4xl font-black tracking-tight text-fg sm:text-5xl">{t("howItWorks.title")}</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-fg-secondary sm:text-lg">{t("howItWorks.lead")}</p>
            <div className="mt-8">
              <Button asChild variant="primary" size="lg">
                <Link href="/explore">{t("howItWorks.ctaExplore")}</Link>
              </Button>
            </div>
          </div>
          <Clip clip="showcase" locale={locale} label={t("howItWorks.heroClip", { share: s })} frameLabel={t("howItWorks.frameLabel")} />
        </div>
      </SectionBackdrop>

      <section className={cn(container, "py-12")} aria-labelledby="how-journey">
        <h2 id="how-journey" className={cn(h2, "mb-6")}>{t("howItWorks.journey.title")}</h2>
        <Journey share={s} />
      </section>

      <section className={cn(container, "py-12")} aria-labelledby="how-ways">
        <h2 id="how-ways" className={cn(h2, "mb-6")}>{t("howItWorks.ways.title")}</h2>
        <Ways share={s} />
      </section>

      <SectionBackdrop direction="down" dome={false} aria-labelledby="how-closing">
        <div className={cn(container, "flex flex-col items-center gap-5 py-16 text-center")}>
          <h2 id="how-closing" className={h2}>{t("howItWorks.closing.title")}</h2>
          <p className="max-w-xl text-sm text-fg-secondary">{t("howItWorks.closing.line")}</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild variant="primary" size="lg">
              <Link href="/explore">{t("howItWorks.ctaExplore")}</Link>
            </Button>
            <Link href="/docs" className={cn(buttonVariants({ variant: "outline", size: "lg", shape: "pill" }))}>
              {t("howItWorks.ctaDocs")}
            </Link>
          </div>
        </div>
      </SectionBackdrop>
    </div>
  );
}
