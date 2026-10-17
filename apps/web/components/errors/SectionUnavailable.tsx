"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button, cn, Mascot } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";

/**
 * One part of a page that could not load (the database was unavailable — lib/degrade.ts): the rest of the page works,
 * this part says so and tries again in place (a refresh of the server components, no full reload).
 */
export function SectionUnavailable({ className }: { className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div role="status" className={cn("flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-default bg-surface-1/60 px-4 py-6 text-center sm:flex-row sm:text-left", className)}>
      <Mascot bird="falcon" mood="error" size={56} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">{t("errorPages.sectionTitle")}</p>
        <p className="mt-0.5 text-xs text-fg-secondary">{t("errorPages.sectionBody")}</p>
      </div>
      <Button variant="secondary" size="sm" loading={pending} onClick={() => startTransition(() => router.refresh())}>
        {pending ? t("errorPages.retrying") : t("errorPages.retry")}
      </Button>
    </div>
  );
}
