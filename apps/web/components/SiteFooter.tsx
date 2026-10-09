import React from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";

/** A quiet footer: brand line, the few links people look for, and the 18+ statement. */
export function SiteFooter() {
  const link = "transition-colors hover:text-fg";
  return (
    <footer className="mb-16 border-t border-border-subtle py-10 text-xs text-fg-muted md:mb-0">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 sm:px-6 md:flex-row">
        <div className="text-center md:text-left">
          <span className="font-display text-sm font-black tracking-wider text-fg">
            OROCHIA<span className="text-accent">.</span>
          </span>
          <p className="mt-1 text-fg-secondary">{t("footer.tagline")}</p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <Link href="/explore" className={link}>{t("footer.explore")}</Link>
          <a href="https://krizaka.com" target="_blank" rel="noopener" className={link}>{t("footer.madeBy")}</a>
          <Link href="/legal/terms" className={link}>{t("footer.terms")}</Link>
          <Link href="/legal/privacy" className={link}>{t("footer.privacy")}</Link>
          <Link href="/legal/2257" className={link}>{t("footer.compliance")}</Link>
          <Link href="/legal/dmca" className={link}>{t("footer.dmca")}</Link>
        </nav>
      </div>
      <div className="mx-auto mt-6 max-w-7xl px-4 text-center text-[11px] text-fg-muted sm:px-6 md:text-left">
        {t("footer.copyright", { year: new Date().getFullYear() })} · {t("footer.adults")}
      </div>
    </footer>
  );
}
