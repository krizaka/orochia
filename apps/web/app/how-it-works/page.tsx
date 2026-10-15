import { AuctionIcon, ChallengeIcon, EditIcon, HeartIcon, LockIcon, Story24hIcon, TipIcon, UnlockIcon, UsersIcon, VideoIcon } from "@krizaka/icons";
import { ArgumentCard } from "@krizaka/ui/argument-card";
import { CardGrid } from "@krizaka/ui/card-grid";
import { Section } from "@krizaka/ui/page";
import { platformFeePercent } from "@orochia/payments";
import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

import { BackdropMedia } from "@/components/home/BackdropMedia";
import { CreatorsCallToAction } from "@/components/home/CreatorsCallToAction";
import { GetPaid } from "@/components/home/GetPaid";
import { MobileSection } from "@/components/mobile/MobileSection";
import { RecordingClip } from "@/components/RecordingClip";
import { Button, buttonVariants, cn, SectionBackdrop } from "@/components/ui";
import { t } from "@/lib/i18n";
import { CREATOR_CLIPS, FAN_CLIPS, SHOWCASE_CLIP, type TourClip, tourRecording } from "@/lib/site-media";

export const metadata: Metadata = { title: t("howItWorks.meta.title"), description: t("howItWorks.meta.description") };

const WAYS = [
  ["tip", TipIcon],
  ["unlock", UnlockIcon],
  ["auction", AuctionIcon],
  ["goal", ChallengeIcon],
] as const;

/** What the platform offers, in one compact section (words: home.features.<id>). */
const FEATURES = [
  ["stories", Story24hIcon],
  ["streaming", VideoIcon],
  ["support", TipIcon],
  ["challenges", ChallengeIcon],
  ["circles", UsersIcon],
  ["editor", EditIcon],
] as const;

const WHY = [
  ["stories", Story24hIcon],
  ["access", LockIcon],
  ["support", HeartIcon],
] as const;

const container = "mx-auto w-full max-w-7xl px-4 sm:px-6";

function Clips({ ids }: { ids: readonly TourClip[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {ids.map((id) => (
        <RecordingClip key={id} media={tourRecording(id)} label={t(`howItWorks.clips.${id}.label`)} caption={t(`howItWorks.clips.${id}.caption`)} frameLabel={t("howItWorks.frameLabel")} />
      ))}
    </div>
  );
}

/** What Orochia is and how it works, for a person who found it by searching: the four ways to pay, then the real application at work. */
export default function HowItWorksPage() {
  const fee = platformFeePercent();
  const share = 100 - fee;
  return (
    <div className="w-full overflow-x-clip">
      <SectionBackdrop direction="up" dome={false} aria-labelledby="how-title">
        <div className={cn(container, "py-16 sm:py-24")}>
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-accent">{t("howItWorks.eyebrow")}</p>
          <h1 id="how-title" className="mt-2 max-w-3xl font-display text-4xl font-black tracking-tight text-fg sm:text-5xl">{t("howItWorks.title")}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-fg-secondary sm:text-lg">{t("howItWorks.lead")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="primary" size="lg">
              <Link href="/explore">{t("howItWorks.ctaExplore")}</Link>
            </Button>
            <Link href="/docs" className={cn(buttonVariants({ variant: "outline", size: "lg", shape: "pill" }))}>
              {t("howItWorks.ctaDocs")}
            </Link>
          </div>
        </div>
      </SectionBackdrop>

      <section className={cn(container, "py-12")} aria-labelledby="how-ways">
        <h2 id="how-ways" className="font-display text-2xl font-black tracking-tight text-fg sm:text-3xl">{t("howItWorks.ways.title")}</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WAYS.map(([key, Icon]) => (
            <li key={key} className="rounded-3xl border border-border-default bg-surface-1/70 p-6">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-fg-accent">
                <Icon size={22} nodeColor="var(--kz-accent-2)" />
              </span>
              <h3 className="text-base font-bold text-fg">{t(`howItWorks.ways.${key}`)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">{t(`howItWorks.ways.${key}Body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={cn(container, "py-10")} aria-labelledby="how-fan">
        <h2 id="how-fan" className="mb-6 font-display text-2xl font-black tracking-tight text-fg sm:text-3xl">{t("howItWorks.fanTitle")}</h2>
        <Clips ids={FAN_CLIPS} />
      </section>

      <section className={cn(container, "py-10")} aria-labelledby="how-creator">
        <h2 id="how-creator" className="mb-6 font-display text-2xl font-black tracking-tight text-fg sm:text-3xl">{t("howItWorks.creatorTitle")}</h2>
        <Clips ids={CREATOR_CLIPS} />
      </section>

      <section className={cn(container, "py-10")} aria-labelledby="how-showcase">
        <h2 id="how-showcase" className="mb-6 font-display text-2xl font-black tracking-tight text-fg sm:text-3xl">{t("howItWorks.showcaseTitle")}</h2>
        <div className="max-w-3xl">
          <RecordingClip media={tourRecording(SHOWCASE_CLIP)} label={t("howItWorks.clips.showcase.label")} caption={t("howItWorks.clips.showcase.caption")} frameLabel={t("howItWorks.frameLabel")} />
        </div>
        <p className="mt-6 max-w-2xl text-xs text-fg-muted">{t("howItWorks.persona")}</p>
      </section>

      <GetPaid fee={fee} />

      <SectionBackdrop direction="down" dome={false} media={<BackdropMedia clips={["fans"]} />} className="orochia-depth" aria-labelledby="home-why">
        <div className={cn(container, "py-16 sm:py-20")}>
          <div data-reveal className="mb-10 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-fg-accent">{t("home.why.eyebrow")}</p>
            <h2 id="home-why" className="mt-2 font-display text-3xl font-black tracking-tight text-fg sm:text-4xl">{t("home.why.title")}</h2>
            <p className="mt-3 text-base leading-relaxed text-fg-secondary">{t("home.why.body")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {WHY.map(([key, Icon], i) => (
              <div key={key} data-reveal style={{ ["--kz-delay" as string]: `${i * 90}ms` }} className="kz-spotlight kz-lift overflow-hidden rounded-3xl border border-border-default bg-surface-1/70 p-6 backdrop-blur-xl">
                <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-fg-accent">
                  <Icon size={22} nodeColor="var(--kz-accent-2)" />
                </span>
                <h3 className="text-base font-bold text-fg">{t(`home.why.${key}.title`)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">{t(`home.why.${key}.body`, { share })}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionBackdrop>

      <Section id="features" title={t("home.features.title")} lead={t("home.features.lead")} reveal>
        <CardGrid min={240}>
          {FEATURES.map(([id, Icon]) => (
            <ArgumentCard key={id} id={`feature-${id}`} title={t(`home.features.${id}.title`)} icon={<Icon size={20} nodeColor="var(--kz-accent-2)" />} hook={{ label: t(`home.features.${id}.title`), text: t(`home.features.${id}.hook`, { share }) }} />
          ))}
        </CardGrid>
      </Section>

      <MobileSection />
      <CreatorsCallToAction share={share} />
    </div>
  );
}
