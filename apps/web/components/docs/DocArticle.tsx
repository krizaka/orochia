import { DocsArticlePage } from "@krizaka/ui/docs-article-page";
import { DocsNav } from "@krizaka/ui/docs-nav";
import Link from "next/link";
import React from "react";

import { AUDIENCES, type Doc, docHref, type DocLocale, docsOf, renderDocPage } from "@/lib/docs";
import { getI18n } from "@/lib/i18n-server";
import { SOURCE_URL } from "@/lib/seo";

/**
 * One page of the documentation on the Krizaka UI `docs-article` template: the pages in groups (a disclosure on a
 * phone), breadcrumb, title, lead, the reading column, the contents beside it, previous and next. The page is the one
 * of the reader's language when it has one, else the English reference.
 */
export async function DocArticle({ doc, locale }: { doc: Doc; locale: DocLocale }) {
  const { t } = await getI18n();
  const { html, toc } = renderDocPage(doc.markdown);
  const siblings = docsOf(doc.audience, locale);
  const at = siblings.findIndex((d) => d.slug === doc.slug);
  const previous = siblings[at - 1];
  const next = siblings[at + 1];
  const groups = AUDIENCES.map((audience) => ({
    id: audience,
    title: t(`docs.groups.${audience}`),
    items: docsOf(audience, locale).map((d) => ({ href: docHref(d), label: d.nav })),
  }));
  const pager = previous || next
    ? {
        previous: previous ? { href: docHref(previous), title: previous.nav } : undefined,
        next: next ? { href: docHref(next), title: next.nav } : undefined,
        labels: { previous: t("docs.previous"), next: t("docs.next") },
      }
    : undefined;
  return (
    <DocsArticlePage
      linkAs={Link}
      sidebarLabel={t("docs.navLabel")}
      sidebar={<DocsNav label={t("docs.navLabel")} groups={groups} current={docHref(doc)} linkAs={Link} />}
      breadcrumbLabel={t("docs.breadcrumbLabel")}
      breadcrumb={[
        { href: "/docs", label: t("docs.eyebrow") },
        { href: docHref(siblings[0]!), label: t(`docs.groups.${doc.audience}`) },
      ]}
      title={doc.title}
      lead={doc.description || undefined}
      toc={toc.length > 1 ? { label: t("docs.onThisPage"), items: toc } : undefined}
      pager={pager}
    >
      {/* The repository's own markdown (docs/**.md, reviewed in pull requests), never user input. */}
      <div className="doc-prose" dangerouslySetInnerHTML={{ __html: html }} />
      {doc.audience === "developers" && locale !== "en" && <p className="mt-6 text-xs text-fg-muted">{t("docs.englishOnly")}</p>}
      <p className="mt-10 border-t border-border-subtle pt-4 text-xs text-fg-muted">
        <a href={`${SOURCE_URL}/blob/main/docs/${doc.file}`} target="_blank" rel="noopener" className="hover:text-fg">{t("docs.editOnGithub")}</a>
      </p>
    </DocsArticlePage>
  );
}
