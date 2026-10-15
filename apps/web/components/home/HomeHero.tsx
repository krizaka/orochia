import { ForwardIcon } from "@krizaka/icons";
import { PageHero } from "@krizaka/ui/page-hero";
import Link from "next/link";
import React from "react";

import { BackdropMedia } from "@/components/home/BackdropMedia";
import { ProductShowcase } from "@/components/home/ProductShowcase";
import { Button, SectionBackdrop } from "@/components/ui";
import { signupEnabled } from "@/lib/features";
import { t } from "@/lib/i18n";

/**
 * The visitor's hero, read in five seconds: the promise, one line, the way in (Explore creators, and a quiet way to
 * learn more) and the phone that plays the real flows. Behind it, three panes of licensed footage out of focus
 * (BackdropMedia), the brand's dome and a perspective floor (SectionBackdrop). The frame, the title and the lead are
 * `@krizaka/ui`'s PageHero — nothing of the page's own but the phone.
 */
export function HomeHero({ share }: { share: number }) {
  return (
    <SectionBackdrop
      direction="down"
      grid
      media={<BackdropMedia layout="panes" eager clips={["hero", "fans", "creators"]} />}
      className="orochia-depth"
      aria-label={t("home.heroTitle")}
    >
      <PageHero
        backdrop="none"
        size="wide"
        className="[&>.kz-frame]:items-center! [&>.kz-frame]:pb-16! [&_.kz-hero-aside]:order-1! [&_.kz-hero-aside]:justify-center!"
        style={{ ["--kz-hero-top" as string]: "clamp(72px, 9vw, 104px)" }}
        title={t("home.heroTitle")}
        lead={t("home.heroLead", { share })}
        aside={
          <div className="flex min-w-0 justify-center">
            <ProductShowcase share={share} />
          </div>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* The one action the page is about: the sheen and the lean toward the pointer, here only. */}
          <Button asChild variant="primary" size="lg" shape="cut" shimmer magnetic className="gap-2">
            <Link href="/explore">
              {t("home.ctaExplore")} <ForwardIcon size={18} />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg" shape="cut">
            <Link href={signupEnabled() ? "/auth/register" : "/how-it-works"}>{signupEnabled() ? t("home.ctaCreate") : t("home.ctaHow")}</Link>
          </Button>
        </div>
      </PageHero>
    </SectionBackdrop>
  );
}
