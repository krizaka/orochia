import { CheckIcon, SearchIcon, TipIcon, UnlockIcon } from "@krizaka/icons";
import { CtaPanel } from "@krizaka/ui/cta-panel";
import { MascotQuote } from "@krizaka/ui/mascot-quote";
import { Section } from "@krizaka/ui/page";
import { PageHero } from "@krizaka/ui/page-hero";
import Link from "next/link";
import React from "react";
import { preconnect } from "react-dom";

import { HomeTour } from "@/components/home/HomeTour";
import { Button } from "@/components/ui";
import { getI18n } from "@/lib/i18n-server";
import { tourRecording } from "@/lib/site-media";
import { HERO_CLIP, HERO_STEPS, HOW_STEPS, TAKE_BEATS } from "@/lib/visitor-home";

const HOW_ICONS = { find: <SearchIcon />, choose: <UnlockIcon />, support: <TipIcon /> } as const;

/**
 * A signed-out visitor's home (lib/visitor-home.ts): the promise with the real app playing (the demo personas' recordings),
 * the real feed as a visitor sees it (VisitorPreview, streamed), how it works in three steps, the
 * creator side with the share computed from the fee setting, the way in. A member gets the feed itself.
 */
export async function VisitorHome({ preview, share, joinHref, joinLabel }: { preview: React.ReactNode; share: number; joinHref: string; joinLabel: string }) {
  const { t, locale } = await getI18n();
  const take = tourRecording(HERO_CLIP, locale);
  const steps = HERO_STEPS.map(({ id }) => ({
    id,
    title: t(`home.visitor.tour.steps.${id}.title`),
    description: t(`home.visitor.tour.steps.${id}.text`, { share }),
    alt: t(`home.visitor.tour.steps.${id}.alt`),
  }));
  // The take's poster is the page's LCP: open the CDN's connection now and fetch it at once (React hoists the link into <head>).
  preconnect(new URL(take.poster).origin);
  return (
    <div className="w-full overflow-x-clip" data-testid="home-intro">
      <link rel="preload" as="image" href={take.poster} fetchPriority="high" />
      {/* 1 · The promise, and the real app as its proof — painted at once (LCP), never revealed. */}
      <PageHero id="hero" eyebrow={t("home.visitor.eyebrow")} title={t("home.visitor.title")} lead={t("home.visitor.lead", { share })}>
        <Button asChild variant="primary" size="lg" shape="cut" shimmer>
          <Link href="/explore">{t("home.ctaExplore")}</Link>
        </Button>
        <Button asChild variant="secondary" size="lg" shape="cut">
          <Link href={joinHref}>{joinLabel}</Link>
        </Button>
        <figure className="m-0 mt-8 flex basis-full flex-col gap-3">
          <HomeTour label={t("home.visitor.tour.label")} steps={steps} beats={TAKE_BEATS[locale]} video={{ webm: take.webm, mp4: take.mp4 }} poster={take.poster} words={{ play: t("home.visitor.tour.play"), pause: t("home.visitor.tour.pause"), step: t("home.visitor.tour.step") }} />
          <figcaption className="text-center text-xs text-fg-muted md:text-start">{t("home.visitor.tour.caption")}</figcaption>
        </figure>
      </PageHero>

      {/* 2 · The real feed, as a visitor sees it. */}
      <Section
        id="preview"
        eyebrow={t("home.visitor.preview.eyebrow")}
        title={t("home.visitor.preview.title")}
        lead={t("home.visitor.preview.lead")}
        divider
        actions={
          <Button asChild variant="secondary" size="md" shape="cut">
            <Link href="/?feed=foryou">{t("home.visitor.preview.cta")}</Link>
          </Button>
        }
      >
        {preview}
      </Section>

      {/* 3 · How it works — three steps for fans; the whole journey is /how-it-works. */}
      <Section
        id="how"
        eyebrow={t("home.visitor.how.eyebrow")}
        title={t("home.visitor.how.title")}
        lead={t("home.visitor.how.lead")}
        divider
        actions={
          <Button asChild variant="secondary" size="md" shape="cut">
            <Link href="/how-it-works">{t("home.visitor.how.cta")}</Link>
          </Button>
        }
      >
        <ol className="grid gap-4 md:grid-cols-3">
          {HOW_STEPS.map((id, i) => (
            <li key={id} className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-1 p-5">
              <span className="flex items-center gap-3 text-fg-accent">
                <span className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</span>
                <span aria-hidden className="[&_svg]:h-5 [&_svg]:w-5">
                  {HOW_ICONS[id]}
                </span>
              </span>
              <h3 className="text-base font-semibold text-fg">{t(`home.visitor.how.steps.${id}.title`)}</h3>
              <p className="text-sm leading-relaxed text-fg-secondary">{t(`home.visitor.how.steps.${id}.text`)}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* 4 · The creator side — the share computed from the fee setting; the flamingo keeps its promise. */}
      <Section id="creators" eyebrow={t("home.visitor.creators.eyebrow")} title={t("home.visitor.creators.title", { share })} lead={t("home.visitor.creators.lead")} divider backdrop>
        <ul className="grid gap-3 sm:grid-cols-3">
          {(["upload", "audience", "paid"] as const).map((id) => (
            <li key={id} className="flex items-start gap-3 rounded-xl border border-border-default bg-surface-1 p-4 text-sm text-fg-secondary">
              <span aria-hidden className="mt-0.5 text-fg-accent [&_svg]:h-4 [&_svg]:w-4">
                <CheckIcon />
              </span>
              {t(`home.visitor.creators.points.${id}`, { share })}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-6">
          <Button asChild variant="primary" size="md" shape="cut">
            <Link href="/creator/apply">{t("home.visitor.creators.cta")}</Link>
          </Button>
        </div>
        <div className="mt-10">
          <MascotQuote bird="flamingo" label={t("home.visitor.flamingoLabel")} variant="callout">
            {t("home.visitor.flamingo")}
          </MascotQuote>
        </div>
      </Section>

      {/* 5 · The way in. */}
      <Section id="closing" spacing="sm">
        <CtaPanel title={t("home.visitor.closing.title")} body={t("home.visitor.closing.body")}>
          <Button asChild variant="primary" size="lg" shape="cut">
            <Link href="/explore">{t("home.visitor.closing.cta")}</Link>
          </Button>
        </CtaPanel>
      </Section>
    </div>
  );
}
