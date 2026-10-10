import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ClientLayoutShell } from "@/components/ClientLayoutShell";
import { MotionObserver, ThemeProvider, ThemeScript, cn } from "@/components/ui";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthProvider } from "@/lib/auth-context";
import { JsonLd } from "@/components/JsonLd";
import { INDEXABLE, NOINDEX, SITE_DESCRIPTION, SITE_NAME, SITE_URL, siteGraph } from "@/lib/seo";
import "./globals.css";

// Variable fonts in the repository (app/fonts, SIL OFL 1.1): no request to Google from the browser, and none from the
// build either — a build that fetched them failed whenever fonts.googleapis.com did not answer the builder.
const outfit = localFont({ src: "./fonts/outfit-latin-wght.woff2", weight: "100 900", variable: "--font-outfit", display: "swap" });
const jakarta = localFont({ src: "./fonts/plus-jakarta-sans-latin-wght.woff2", weight: "200 800", variable: "--font-jakarta", display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Orochia — Video Platform for Independent Creators", template: "%s — Orochia" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "creator video platform",
    "independent creators",
    "open-source video platform",
    "adult-friendly creator platform",
    "HLS streaming",
    "creator monetization",
    "tips and paid unlocks",
    "2257 compliance",
    "Bunny Stream",
  ],
  authors: [{ name: "Krizaka", url: "https://krizaka.com" }],
  creator: "Krizaka",
  publisher: "Krizaka",
  openGraph: { type: "website", siteName: SITE_NAME, url: "/", title: "Orochia — the platform independent creators own", description: SITE_DESCRIPTION, locale: "en_US" },
  twitter: { card: "summary_large_image", title: "Orochia — the platform independent creators own", description: SITE_DESCRIPTION },
  robots: !INDEXABLE ? NOINDEX : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-video-preview": -1 } },
  // Adult content labelled as such: SafeSearch and parental filters classify the site correctly.
  other: { rating: "adult", RATING: "RTA-5042-1996-1400-1577-RTA" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(outfit.variable, jakarta.variable, "overflow-x-hidden max-w-full w-full")}>
      <head>
        {/* Applies the persisted theme (`kz-theme`: dark · light · system) before the first paint: no flash. */}
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-surface-0 text-fg antialiased selection:bg-accent selection:text-on-accent pb-20 md:pb-0 overflow-x-hidden max-w-full w-full relative">
        <JsonLd data={siteGraph()} />
        <ThemeProvider>
          <AuthProvider>
            <ClientLayoutShell>{children}</ClientLayoutShell>
            <MotionObserver />
            <SiteFooter />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
