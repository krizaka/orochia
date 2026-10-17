import React from "react";

import { Clip } from "@/components/how-it-works/Clip";
import { JOURNEY } from "@/lib/how-it-works";
import { getI18n } from "@/lib/i18n-server";

/**
 * The journey: seven steps, one line and one real recording each. This is the one slot `StepShowcase`
 * (@krizaka/ui) replaces — it takes the same JOURNEY list and the same lines, nothing else on the page changes.
 */
export async function Journey({ share }: { share: number }) {
  const { t, locale } = await getI18n();
  return (
    <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {JOURNEY.map((step, i) => (
        <li key={step.id} data-testid={`journey-${step.id}`} className="flex flex-col gap-3">
          <Clip clip={step.clip} locale={locale} label={t(`howItWorks.steps.${step.id}`, { share })} frameLabel={t("howItWorks.frameLabel")} />
          <p className="text-sm leading-snug text-fg">
            <span className="mr-2 font-mono text-xs font-semibold text-fg-accent">{i + 1}</span>
            {t(`howItWorks.steps.${step.id}`, { share })}
          </p>
        </li>
      ))}
    </ol>
  );
}
