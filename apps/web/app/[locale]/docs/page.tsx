import { DocsHubPage } from "@krizaka/ui/docs-hub-page";
import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

import { AUDIENCES, docHref, docsOf } from "@/lib/docs";
import { getI18n, localeFromParams } from "@/lib/i18n-server";
import { SOURCE_URL } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await localeFromParams(params);
  const { t } = await getI18n();
  return { title: t("docs.meta.title"), description: t("docs.meta.description") };
}

/** The documentation hub (the Krizaka UI `docs-hub` template): the Guide for fans and creators, the pages for developers. */
export default async function DocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await localeFromParams(params);
  const { t } = await getI18n();
  const guide = docsOf("guide", locale);
  return (
    <>
      <DocsHubPage
        linkAs={Link}
        eyebrow={t("docs.eyebrow")}
        title={t("docs.title")}
        lead={t("docs.lead")}
        collectionsTitle={t("docs.collectionsTitle")}
        collections={AUDIENCES.map((audience) => {
          const docs = docsOf(audience, locale);
          return {
            id: audience,
            title: t(`docs.groups.${audience}`),
            href: docHref(docs[0]!),
            description: t(`docs.collections.${audience}`),
            links: docs.slice(0, 4).map((d) => ({ href: docHref(d), label: d.nav })),
          };
        })}
        popular={{
          title: t("docs.popularTitle"),
          items: guide.slice(0, 5).map((d) => ({ href: docHref(d), title: d.title, meta: t("docs.groups.guide") })),
        }}
        promise={{ label: t("docs.promise.label"), text: t("docs.promise.text") }}
      />
      <p className="mx-auto w-full max-w-5xl px-4 pb-16 text-sm sm:px-6">
        <a href={SOURCE_URL} target="_blank" rel="noopener" className="font-semibold text-fg-accent hover:underline">{t("docs.source")}</a>
      </p>
    </>
  );
}
