import React from "react";

import { Mascot, SectionBackdrop } from "@/components/ui";

/**
 * A whole-page state — an error, a page that does not exist — in Orochia's language: the brand's section backdrop, a
 * bird of the Krizaka flock (the falcon watches over errors, the owl reads and did not find), words that say what
 * happened and what to do, the way out, and the error reference when there is one. Server-safe; the header and the
 * footer of the layout stay around it, so nobody is stranded.
 */
export function PageState({
  bird,
  mood,
  eyebrow,
  title,
  body,
  hint,
  actions,
  reference,
  children,
  as = "section",
}: {
  bird: "falcon" | "owl";
  mood: "error" | "empty" | "thinking";
  eyebrow: string;
  title: string;
  body: string;
  hint?: string;
  actions: React.ReactNode;
  reference?: React.ReactNode;
  children?: React.ReactNode;
  /** `section` inside the layout (its `<main>` is there); `main` in global-error, which has no layout. */
  as?: "section" | "main";
}) {
  const page = (
    <SectionBackdrop as="section" className="flex min-h-[70vh] items-center overflow-hidden px-4 py-14 sm:px-6 sm:py-20">
      <div className="relative mx-auto flex w-full max-w-xl flex-col items-center text-center">
        <span className="flex h-36 w-36 items-center justify-center rounded-full border border-accent/20 bg-accent/10 shadow-lg sm:h-40 sm:w-40" aria-hidden>
          <Mascot bird={bird} mood={mood} size={112} />
        </span>
        <p className="mt-6 text-[10px] font-bold text-fg-accent">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl font-black tracking-tight text-fg text-balance sm:text-5xl">{title}</h1>
        <p className="mt-3 max-w-md text-sm text-fg-secondary text-pretty sm:text-base">{body}</p>
        {hint && <p className="mt-2 max-w-md text-xs text-fg-muted text-pretty sm:text-sm">{hint}</p>}
        {children && <div className="mt-6 w-full max-w-md">{children}</div>}
        <div className="mt-7 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">{actions}</div>
        {reference && <div className="mt-8">{reference}</div>}
      </div>
    </SectionBackdrop>
  );
  return as === "main" ? <main>{page}</main> : page;
}
