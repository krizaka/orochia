import Link from "next/link";
import React from "react";

import { cn } from "@/components/ui";
import { WAYS } from "@/lib/how-it-works";
import { getI18n } from "@/lib/i18n-server";
import { tourRecording } from "@/lib/site-media";

/** The four ways to pay a creator: each card shows its moment from the app (the recording's poster), one line, one link. */
export async function Ways({ share }: { share: number }) {
  const { t } = await getI18n();
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {WAYS.map(({ id, clip, icon: Icon, href }) => (
        <li key={id}>
          <Link
            href={href}
            className={cn(
              "group flex h-full flex-col overflow-hidden rounded-3xl border border-border-default bg-surface-1/70 transition-colors",
              "hover:border-accent/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <img src={tourRecording(clip).poster} alt="" loading="lazy" decoding="async" className="aspect-video w-full object-cover" />
            <span className="flex flex-1 flex-col gap-1 p-4">
              <span className="flex items-center gap-2 text-base font-bold text-fg">
                <Icon size={18} nodeColor="var(--kz-accent-2)" /> {t(`howItWorks.ways.${id}`)}
              </span>
              <span className="text-sm leading-snug text-fg-secondary">{t(`howItWorks.ways.${id}Line`, { share })}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
