import type { Metadata } from "next";
import { notFound } from "next/navigation";
import React from "react";

import { DocArticle } from "@/components/docs/DocArticle";
import { docsOf, findDoc } from "@/lib/docs";
import { localeFromParams } from "@/lib/i18n-server";

export const dynamicParams = false;

export function generateStaticParams() {
  return docsOf("guide").map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const locale = await localeFromParams(params);
  const doc = findDoc("guide", (await params).slug, locale);
  return doc ? { title: doc.title, description: doc.description || undefined } : {};
}

/** One page of the Guide (fans and creators), rendered from docs/guide/<slug>.md, or its French twin in docs/guide/fr/. */
export default async function GuidePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const locale = await localeFromParams(params);
  const doc = findDoc("guide", (await params).slug, locale);
  if (!doc) notFound();
  return <DocArticle doc={doc} locale={locale} />;
}
