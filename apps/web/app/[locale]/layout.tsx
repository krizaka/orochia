import "./globals.css";
import "@krizaka/ui/blocks.css";

import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { ClientLayoutShell } from "@/components/ClientLayoutShell";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { uiVersion } from "@/lib/ui-version";
import { cn,MotionObserver, ThemeProvider, ThemeScript } from "@/components/ui";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n-client";
import { getI18n, setRequestLocale } from "@/lib/i18n-server";
import { isLocale, LOCALES, localizedPath, ogLocale } from "@/lib/locales";
import { INDEXABLE, KRIZAKA_URL, NOINDEX, SITE_NAME, SITE_URL, siteGraph } from "@/lib/seo";

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

type Props = { params: Promise<{ locale: string }> };

/** One page per language, generated once: nothing in the layout reads the request. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const requested = (await params).locale;
  if (!isLocale(requested)) return {};
  setRequestLocale(requested);
  const { t, locale } = await getI18n();
  const description = t("seo.siteDescription");
  const ogTitle = t("seo.ogTitle");
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("seo.title"), template: "%s — Orochia" },
    description,
    applicationName: SITE_NAME,
    keywords: t("seo.keywords").split(",").map((k) => k.trim()),
    authors: [{ name: "Krizaka", url: KRIZAKA_URL }],
    // Every page is canonical to itself, at its address in its language (relative to metadataBase); a page gives its hreflang pair with `pageAlternates`, and may override this.
    alternates: { canonical: "./" },
    creator: "Krizaka",
    publisher: "Krizaka",
    openGraph: { type: "website", siteName: SITE_NAME, url: localizedPath("/", locale), title: ogTitle, description, locale: ogLocale(locale), alternateLocale: ogLocale(locale === "fr" ? "en" : "fr") },
    twitter: { card: "summary_large_image", title: ogTitle, description },
    robots: !INDEXABLE ? NOINDEX : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-video-preview": -1 } },
    // Adult content labelled as such: SafeSearch and parental filters classify the site correctly.
    other: { rating: "adult", RATING: "RTA-5042-1996-1400-1577-RTA" },
  };
}

export default async function RootLayout({ children, params }: Props & { children: React.ReactNode }) {
  const requested = (await params).locale;
  if (!isLocale(requested)) notFound();
  setRequestLocale(requested);
  const { t, locale } = await getI18n();
  return (
    <html lang={locale} suppressHydrationWarning className={cn(outfit.variable, jakarta.variable, "overflow-x-clip max-w-full w-full")}>
      <head>
        {/* Applies the persisted theme (`kz-theme`: dark · light · system) before the first paint: no flash. */}
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-surface-0 text-fg antialiased selection:bg-accent selection:text-on-accent pb-20 md:pb-0 overflow-x-clip max-w-full w-full relative">
        <JsonLd data={siteGraph(t, locale)} />
        <ThemeProvider>
          <I18nProvider locale={locale}>
          <AuthProvider>
            <ClientLayoutShell>{children}</ClientLayoutShell>
            <MotionObserver />
            <SiteFooter uiVersion={uiVersion()} devNotice={!INDEXABLE} />
          </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
