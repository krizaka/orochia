import type { Metadata } from "next";
import { notFound } from "next/navigation";
import React from "react";

import { DocArticle } from "@/components/docs/DocArticle";
import { docsOf, findDoc } from "@/lib/docs";
import { localeFromParams } from "@/lib/i18n-server";

export const dynamicParams = false;

export function generateStaticParams() {
  return docsOf("developers").map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const doc = findDoc("developers", (await params).slug, locale);
  return doc ? { title: doc.title, description: doc.description || undefined } : {};
}

/** One page for developers (the open-source project), rendered from the repository's docs/*.md — in English. */
export default async function DevelopersPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const locale = await localeFromParams(params);
  const doc = findDoc("developers", (await params).slug, locale);
  if (!doc) notFound();
  return <DocArticle doc={doc} locale={locale} />;
}
