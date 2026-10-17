"use client";

import { usePathname } from "next/navigation";
import React from "react";

import { cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, localizedPath, type Locale } from "@/lib/locales";

/**
 * The language switch: names the other language in that language (« Français » on an English page, « English » on a
 * French one), writes the family's cookie (`NEXT_LOCALE`) and opens the same page at its address in that language
 * (`/fr<path>` for French, the path itself for English) — so the choice is remembered and the address can be shared.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const target: Locale = locale === "fr" ? "en" : "fr";

  function choose() {
    try {
      document.cookie = `${LOCALE_COOKIE}=${target}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    } catch {
      // A browser that refuses the cookie still gets the page in the other language through its address.
    }
    // A full navigation, not a client transition: the layout carries the language (the <html lang>, the catalogue).
    window.location.href = `${localizedPath(pathname || "/", target)}${window.location.search}${window.location.hash}`;
  }

  return (
    <button
      type="button"
      onClick={choose}
     
      aria-label={t("common.language.switchTo")}
      title={t("common.language.switchTo")}
      className={cn(
        "inline-flex h-9 items-center rounded-xl px-2.5 text-xs font-semibold uppercase tracking-wider text-fg-secondary transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span lang={target}>{t("common.language.target")}</span>
    </button>
  );
}
