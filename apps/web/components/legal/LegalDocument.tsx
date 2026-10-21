import { ArrowLeft, CheckCircle2, type LucideIcon,Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

import { Rich } from "@/components/Rich";
import type { I18nTools, Messages } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import { pageAlternates } from "@/lib/seo-i18n";

export type LegalDocId = keyof Messages["legal"]["docs"];

interface LegalSection {
  title: string;
  paragraphs?: Record<string, string>;
  items?: Record<string, string>;
  points?: Record<string, { lead: string; text: string }>;
  contact?: { name: string; emails: string };
  note?: string;
}

interface LegalDoc {
  metaTitle: string;
  metaDescription: string;
  badge: string;
  title: string;
  subtitle: string;
  sections: Record<string, LegalSection>;
}

const docOf = (messages: I18nTools["messages"], id: LegalDocId) => messages("legal").docs[id] as unknown as LegalDoc;

/** The `generateMetadata` of a legal page, in the language of the request. */
export async function legalMetadata(id: LegalDocId, path: string): Promise<Metadata> {
  const { messages } = await getI18n();
  const { metaTitle, metaDescription } = docOf(messages, id);
  return { title: metaTitle, description: metaDescription, alternates: await pageAlternates(path) };
}

/** A legal page rendered from its messages (`legal.docs.<id>`): the words live in en.json, the layout once here. */
export async function LegalDocument({ id, icon: Icon }: { id: LegalDocId; icon: LucideIcon }) {
  const { t, messages } = await getI18n();
  const { badge, title, subtitle, sections } = docOf(messages, id);
  const slots = {
    dmca: (
      <Link href="/legal/dmca" className="font-semibold text-fg-accent underline-offset-2 hover:underline">
        {t("legal.dmcaLink")}
      </Link>
    ),
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-fg-secondary transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> {t("legal.back")}
      </Link>

      <header className="mb-10" data-reveal>
        <span className="mb-4 inline-flex items-center gap-2 rounded-sm border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-fg-accent">
          <Icon className="h-3.5 w-3.5" aria-hidden /> {badge}
        </span>
        <h1 className="font-display text-3xl font-black text-fg sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-fg-secondary">{subtitle}</p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-fg-secondary">
        {Object.entries(sections).map(([key, s], i) => (
          <section key={key} id={key} data-reveal style={{ "--kz-delay": `${i * 60}ms` } as React.CSSProperties} className="glass-panel scroll-mt-24 rounded-2xl p-6 sm:p-8">
            <h2 className="mb-3 font-display text-lg font-bold text-fg">{s.title}</h2>
            {Object.entries(s.paragraphs ?? {}).map(([k, p]) => (
              <p key={k} className="mt-3 first-of-type:mt-0">
                <Rich text={p} slots={slots} />
              </p>
            ))}
            {s.items && (
              <ul className="mt-3 list-inside list-disc space-y-1.5 pl-2 text-fg-secondary">
                {Object.entries(s.items).map(([k, item]) => <li key={k}>{item}</li>)}
              </ul>
            )}
            {s.points && (
              <div className="mt-4 space-y-3">
                {Object.entries(s.points).map(([k, point]) => (
                  <div key={k} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-fg-accent" aria-hidden />
                    <p>
                      <strong className="text-fg">{point.lead}</strong> {point.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {s.contact && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-2/60 p-4">
                <Mail className="h-5 w-5 text-fg-accent" aria-hidden />
                <div>
                  <p className="text-xs font-semibold text-fg">{s.contact.name}</p>
                  <p className="text-xs text-fg-secondary">{s.contact.emails}</p>
                </div>
              </div>
            )}
            {s.note && <p className="mt-4 text-xs text-fg-muted">{s.note}</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
