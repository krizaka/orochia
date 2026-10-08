import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { ClientLayoutShell } from "@/components/ClientLayoutShell";
import { MotionObserver } from "@/components/ui";
import { SiteFooter } from "@/components/SiteFooter";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/components/ThemeProvider";
import { JsonLd } from "@/components/JsonLd";
import { INDEXABLE, NOINDEX, SITE_DESCRIPTION, SITE_NAME, SITE_URL, siteGraph } from "@/lib/seo";
import "./globals.css";

// Self-hosted at build time by next/font: no request to Google from the visitor's browser.
const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-outfit", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-jakarta", display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
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
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${jakarta.variable} overflow-x-hidden max-w-full w-full`}>
      <head>
        {/* Anti-flicker script for instant dark/light hydration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var match = document.cookie.match(new RegExp('(^| )kz-theme=([^;]+)'));
                  var theme = match ? match[2] : localStorage.getItem('kz-theme');
                  if (!theme) {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.classList.remove('dark', 'light');
                  document.documentElement.classList.add(theme);
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-violet-600 selection:text-white pb-20 md:pb-0 overflow-x-hidden max-w-full w-full relative">
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
