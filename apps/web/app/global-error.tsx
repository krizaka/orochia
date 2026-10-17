"use client";

import "./globals.css";

import Link from "next/link";

import { ServerError } from "@/components/errors/ServerError";
import { cn, OrochiaLogo, ThemeProvider, ThemeScript } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";

import { jakarta, outfit } from "./fonts";

/**
 * When the root layout itself fails, Next renders this document instead of it: same fonts, same styles, the person's
 * theme (`kz-theme`, applied before paint), the brand in a bar that leads home, and the falcon's page.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useI18n();
  return (
    <html lang="en" suppressHydrationWarning className={cn(outfit.variable, jakarta.variable)}>
      <head>
        <title>{t("errorPages.serverMetaTitle")}</title>
        <meta name="robots" content="noindex" />
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-surface-0 text-fg antialiased">
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
      </body>
    </html>
  );
}
