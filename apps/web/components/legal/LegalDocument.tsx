import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, Mail, type LucideIcon } from "lucide-react";
import { Rich } from "@/components/Rich";
import { messages, t } from "@/lib/i18n";

export type LegalDocId = keyof ReturnType<typeof messages<"legal">>["docs"];

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

const doc = (id: LegalDocId) => messages("legal").docs[id] as unknown as LegalDoc;

export function legalMetadata(id: LegalDocId, path: string): Metadata {
  const { metaTitle, metaDescription } = doc(id);
  return { title: metaTitle, description: metaDescription, alternates: { canonical: path } };
}

/** A legal page rendered from its messages (`legal.docs.<id>`): the words live in en.json, the layout once here. */
export function LegalDocument({ id, icon: Icon }: { id: LegalDocId; icon: LucideIcon }) {
  const { badge, title, subtitle, sections } = doc(id);
  const slots = {
    dmca: (
      <Link href="/legal/dmca" className="font-semibold text-violet-400 underline-offset-2 hover:underline light:text-violet-700">
        {t("legal.dmcaLink")}
      </Link>
    ),
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/" className="mb-8 inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 transition-colors hover:text-white light:text-slate-500 light:hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" /> {t("legal.back")}
      </Link>

      <header className="mb-10" data-reveal>
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 light:text-violet-700">
          <Icon className="h-3.5 w-3.5" aria-hidden /> {badge}
        </span>
        <h1 className="font-display text-3xl font-black text-white sm:text-4xl light:text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-zinc-400 light:text-slate-500">{subtitle}</p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-zinc-300 light:text-slate-700">
        {Object.entries(sections).map(([key, s], i) => (
          <section key={key} id={key} data-reveal style={{ "--kz-delay": `${i * 60}ms` } as React.CSSProperties} className="glass-panel scroll-mt-24 rounded-2xl p-6 sm:p-8">
            <h2 className="mb-3 font-display text-lg font-bold text-white light:text-slate-900">{s.title}</h2>
            {Object.entries(s.paragraphs ?? {}).map(([k, p]) => (
              <p key={k} className="mt-3 first-of-type:mt-0">
                <Rich text={p} slots={slots} />
              </p>
            ))}
            {s.items && (
              <ul className="mt-3 list-inside list-disc space-y-1.5 pl-2 text-zinc-400 light:text-slate-600">
                {Object.entries(s.items).map(([k, item]) => <li key={k}>{item}</li>)}
              </ul>
            )}
            {s.points && (
              <div className="mt-4 space-y-3">
                {Object.entries(s.points).map(([k, point]) => (
                  <div key={k} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-violet-400" aria-hidden />
                    <p>
                      <strong className="text-white light:text-slate-900">{point.lead}</strong> {point.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {s.contact && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/5 bg-zinc-900/60 p-4 light:border-black/10 light:bg-slate-50">
                <Mail className="h-5 w-5 text-violet-400" aria-hidden />
                <div>
                  <p className="text-xs font-semibold text-white light:text-slate-900">{s.contact.name}</p>
                  <p className="text-xs text-zinc-400 light:text-slate-500">{s.contact.emails}</p>
                </div>
              </div>
            )}
            {s.note && <p className="mt-4 text-xs text-zinc-500 light:text-slate-500">{s.note}</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
