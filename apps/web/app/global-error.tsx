"use client";

import "./[locale]/globals.css";

import Link from "next/link";

import { ServerError } from "@/components/errors/ServerError";
import { cn, OrochiaLogo, ThemeProvider, ThemeScript } from "@/components/ui";
import { toolsFor } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n-client";
import { DEFAULT_LOCALE, isLocale, localeFromAcceptLanguage, LOCALE_COOKIE, type Locale } from "@/lib/locales";

import { jakarta, outfit } from "./[locale]/fonts";

function failedLayoutLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const chosen = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`).exec(document.cookie)?.[1];
  return isLocale(chosen) ? chosen : localeFromAcceptLanguage(navigator.language);
}

/**
 * When the root layout itself fails, Next renders this document instead of it: same fonts, same styles, the person's
 * theme (`kz-theme`, applied before paint), the brand in a bar that leads home, and the falcon's page.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // The root layout, and its language provider, failed: the language is read again from the family's cookie, else the browser.
  const locale = failedLayoutLocale();
  const { t } = toolsFor(locale);
  return (
    <html lang={locale} suppressHydrationWarning className={cn(outfit.variable, jakarta.variable)}>
      <head>
        <title>{t("errorPages.serverMetaTitle")}</title>
        <meta name="robots" content="noindex" />
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-surface-0 text-fg antialiased">
        <I18nProvider locale={locale}>
        <ThemeProvider>
          <header className="border-b border-border-default bg-surface-0/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
              <Link href="/" aria-label={t("errorPages.home")} className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                <OrochiaLogo size={30} />
                <span className="font-display text-base font-black tracking-wider text-fg sm:text-lg">
                  OROCHIA<span className="text-fg-accent">.</span>
                </span>
              </Link>
            </div>
          </header>
          <ServerError digest={error.digest} retry={retry} as="main" />
        </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
