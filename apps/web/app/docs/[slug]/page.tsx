import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import React from "react";

import { DOCS, findDoc, renderDoc } from "@/lib/docs";
import { t } from "@/lib/i18n";
import { SOURCE_URL } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = findDoc((await params).slug);
  return doc ? { title: doc.title, description: doc.description || undefined } : {};
}

/** One page of the repository's docs/, rendered from its markdown. */
export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const doc = findDoc((await params).slug);
  if (!doc) notFound();
  const html = renderDoc(doc.markdown);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
      <nav aria-label={t("docs.navLabel")} className="mb-8 lg:mb-0">
        <Link href="/docs" className="text-xs font-semibold uppercase tracking-wider text-fg-accent hover:underline">{t("docs.back")}</Link>
        <ul className="mt-3 hidden space-y-1 text-sm lg:block">
          {DOCS.map((d) => (
            <li key={d.slug}>
              <Link href={`/docs/${d.slug}`} aria-current={d.slug === doc.slug ? "page" : undefined} className={d.slug === doc.slug ? "font-semibold text-fg" : "text-fg-secondary hover:text-fg"}>
                {d.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="min-w-0">
        {/* The repository's own markdown (docs/*.md, reviewed in pull requests), never user input. */}
        <div className="doc-prose" dangerouslySetInnerHTML={{ __html: html }} />
        <p className="mt-10 border-t border-border-subtle pt-4 text-xs text-fg-muted">
          <a href={`${SOURCE_URL}/blob/main/docs/${doc.file}`} target="_blank" rel="noopener" className="hover:text-fg">{t("docs.editOnGithub")}</a>
        </p>
      </article>
    </div>
  );
}
