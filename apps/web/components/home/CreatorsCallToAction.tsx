import { CheckIcon, ForwardIcon, UploadIcon } from "@krizaka/icons";
import Link from "next/link";
import React from "react";

import { BackdropMedia } from "@/components/home/BackdropMedia";
import { buttonVariants, cn, OrochiaLogo, SectionBackdrop } from "@/components/ui";
import { t } from "@/lib/i18n";

/** The closing call to action for creators: the promise in one line, three facts, the way in. Ends tinted (`up`). */
export function CreatorsCallToAction({ share }: { share: number }) {
  return (
    <SectionBackdrop
      direction="up"
      media={<BackdropMedia clips={["creators"]} />}
      className="orochia-depth"
      aria-labelledby="home-creators"
    >
      <div data-reveal className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
        <OrochiaLogo size={56} />
        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-fg-accent">{t("home.creators.eyebrow")}</p>
        <h2 id="home-creators" className="mt-3 font-display text-3xl font-black leading-tight tracking-tight text-fg sm:text-5xl">
          {t("home.creators.title")}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-secondary sm:text-lg">{t("home.creators.body")}</p>
        <ul className="mt-6 flex flex-col flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-fg-secondary sm:flex-row">
          {(["upload", "audience", "paid"] as const).map((i) => (
            <li key={i} className="flex items-center justify-center gap-2">
              <CheckIcon size={16} className="text-success" /> {t(`home.creators.points.${i}`, { share })}
            </li>
          ))}
        </ul>
        <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Link href="/auth/register" className={cn(buttonVariants({ variant: "primary", size: "lg", shape: "pill" }), "kz-sheen gap-2 shadow-lg")}>
            <UploadIcon size={18} /> {t("home.creators.cta")}
          </Link>
          <Link href="/explore" className={cn(buttonVariants({ variant: "outline", size: "lg", shape: "pill" }), "gap-2 bg-surface-1/60 backdrop-blur-md")}>
            {t("home.ctaExplore")} <ForwardIcon size={18} />
          </Link>
        </div>
      </div>
    </SectionBackdrop>
  );
}
