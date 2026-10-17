import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

import { cn } from "@/components/ui";
import { DOCS } from "@/lib/docs";
import { getI18n, localeFromParams } from "@/lib/i18n-server";
import { SOURCE_URL } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await localeFromParams(params);
  const { t } = await getI18n();
  return { title: t("docs.meta.title"), description: t("docs.meta.description") };
}

/** The documentation hub: every public page of the repository's docs/, one card each. */
export default async function DocsPage({ params }: { params: Promise<{ locale: string }> }) {
  await localeFromParams(params);
  const { t } = await getI18n();
  return (
    <div className={cn("mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20")}>
      <p className="text-xs font-semibold uppercase tracking-wider text-fg-accent">{t("docs.eyebrow")}</p>
      <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-fg sm:text-5xl">{t("docs.title")}</h1>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-fg-secondary">{t("docs.lead")}</p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {DOCS.map((doc) => (
          <li key={doc.slug}>
            <Link href={`/docs/${doc.slug}`} className="block h-full rounded-3xl border border-border-default bg-surface-1/70 p-5 transition-colors hover:border-border-strong focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
              <h2 className="text-base font-bold text-fg">{doc.title}</h2>
              {doc.description ? <p className="mt-1.5 text-sm leading-relaxed text-fg-secondary">{doc.description}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm">
        <a href={SOURCE_URL} target="_blank" rel="noopener" className="font-semibold text-fg-accent hover:underline">{t("docs.source")}</a>
      </p>
    </div>
  );
}
