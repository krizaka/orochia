import React from "react";

import { PhoneClip } from "@/components/mobile/PhoneClip";
import { cn } from "@/components/ui";
import { getI18n } from "@/lib/i18n-server";
import { type MobileStep } from "@/lib/mobile-media";

/** One step of the journey: the phone with its recording, then the fan's goal, what the screen does and what to notice. */
export async function MobileStepCard({ id, index }: { id: MobileStep; index: number }) {
  const { messages, t } = await getI18n();
  const titleId = `mobile-step-${id}`;
  const notice = messages("mobile").steps[id].notice;
  return (
    <li>
      <article aria-labelledby={titleId} className={cn("grid items-center gap-8 md:gap-14", index % 2 === 1 ? "md:grid-cols-[1fr_15rem]" : "md:grid-cols-[15rem_1fr]")}>
        <div className={cn(index % 2 === 1 && "md:order-2")}>
          <PhoneClip id={id} label={t(`mobile.steps.${id}.goal`)} alt={t(`mobile.steps.${id}.alt`)} />
        </div>
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-accent">
            {t("mobile.step")} {index + 1}
          </p>
          <h3 id={titleId} className="font-display text-2xl font-black tracking-tight text-fg sm:text-3xl">
            {t(`mobile.steps.${id}.goal`)}
          </h3>
          <p className="max-w-xl text-base leading-relaxed text-fg-secondary">{t(`mobile.steps.${id}.purpose`)}</p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{t("mobile.notice")}</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-fg-secondary marker:text-fg-accent">
              {notice.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      </article>
    </li>
  );
}
