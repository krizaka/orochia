import "./globals.css";
import "@krizaka/ui/blocks.css";

import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

import { ClientLayoutShell } from "@/components/ClientLayoutShell";
import { DevEnvironmentNotice } from "@/components/DevEnvironmentNotice";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { cn,MotionObserver, ThemeProvider, ThemeScript } from "@/components/ui";
import { AuthProvider } from "@/lib/auth-context";
import { getDictionary } from "@/lib/i18n";
import { I18nProvider } from "@/lib/i18n-client";
import { getI18n } from "@/lib/i18n-server";
import { localizedPath, ogLocale, PATH_HEADER } from "@/lib/locales";
import { INDEXABLE, KRIZAKA_URL, NOINDEX, SITE_NAME, SITE_URL, siteGraph } from "@/lib/seo";
import { alternatesFor } from "@/lib/seo-i18n";

import { jakarta, outfit } from "./fonts";


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getI18n();
  const description = t("seo.siteDescription");
  const ogTitle = t("seo.ogTitle");
  const path = (await headers()).get(PATH_HEADER) ?? "/";
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("seo.title"), template: "%s — Orochia" },
    description,
    applicationName: SITE_NAME,
    keywords: t("seo.keywords").split(",").map((k) => k.trim()),
    authors: [{ name: "Krizaka", url: KRIZAKA_URL }],
    // Every page is canonical to itself in the language it is served in, with its hreflang pair; a page with its own `alternates` overrides it.
    alternates: alternatesFor(path, locale),
    creator: "Krizaka",
    publisher: "Krizaka",
    openGraph: { type: "website", siteName: SITE_NAME, url: localizedPath("/", locale), title: ogTitle, description, locale: ogLocale(locale), alternateLocale: ogLocale(locale === "fr" ? "en" : "fr") },
    twitter: { card: "summary_large_image", title: ogTitle, description },
    robots: !INDEXABLE ? NOINDEX : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-video-preview": -1 } },
    // Adult content labelled as such: SafeSearch and parental filters classify the site correctly.
    other: { rating: "adult", RATING: "RTA-5042-1996-1400-1577-RTA" },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t, locale } = await getI18n();
  return (
    <html lang={locale} suppressHydrationWarning className={cn(outfit.variable, jakarta.variable, "overflow-x-hidden max-w-full w-full")}>
      <head>
        {/* Applies the persisted theme (`kz-theme`: dark · light · system) before the first paint: no flash. */}
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-surface-0 text-fg antialiased selection:bg-accent selection:text-on-accent pb-20 md:pb-0 overflow-x-hidden max-w-full w-full relative">
        <JsonLd data={siteGraph(t, locale)} />
        <ThemeProvider>
          <I18nProvider locale={locale} messages={getDictionary(locale)}>
          <AuthProvider>
            <ClientLayoutShell>{children}</ClientLayoutShell>
            <MotionObserver />
            <SiteFooter />
            {!INDEXABLE && <DevEnvironmentNotice />}
          </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
