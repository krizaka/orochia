"use client";

import { type Language, languageNames,LanguageSwitch as FamilyLanguageSwitch } from "@krizaka/ui/language-switch";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-client";
import { type Locale,LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, localizedPath } from "@/lib/locales";

const LOCALES: readonly Locale[] = ["en", "fr"];

/** A language link that first writes the family's cookie (`NEXT_LOCALE`), so the choice is remembered; the browser then
    opens the same page at its address in that language (a full navigation: the layout carries the language). */
function RememberedLink({ onClick, ...props }: ComponentProps<"a">) {
  const { user } = useAuth();
  return (
    <a
      {...props}
      onClick={(e) => {
        onClick?.(e);
        try {
          document.cookie = `${LOCALE_COOKIE}=${props.hrefLang}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
        } catch {
          // A browser that refuses the cookie still gets the page in the other language through its address.
        }
        // A signed-in account keeps the choice: its e-mails, push and notifications are written in that language.
        if (user) {
          void fetch("/api/me/locale", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: props.hrefLang }), keepalive: true }).catch(() => undefined);
        }
      }}
    />
  );
}

/** The family's language switch (`@krizaka/ui/language-switch`): a globe and the current code, the languages by their own names. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { t, locale } = useI18n();
  const pathname = usePathname() || "/";
  const languages: Language[] = LOCALES.map((code) => ({ code, name: languageNames[code] ?? code, href: localizedPath(pathname, code) }));
  return <FamilyLanguageSwitch label={t("common.language.label")} current={locale} languages={languages} linkAs={RememberedLink} className={className} />;
}
