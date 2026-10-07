import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { AgeVerificationModal } from "@/components/AgeVerificationModal";
import { AuthProvider } from "@/lib/auth-context";
import { JsonLd } from "@/components/JsonLd";
import { INDEXABLE, NOINDEX, SITE_DESCRIPTION, SITE_NAME, SITE_URL, siteGraph } from "@/lib/seo";
import "./globals.css";

// Self-hosted at build time by next/font: no request to Google from the visitor's browser.
const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-outfit", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Orochia — Open-Source Video Platform for Independent Creators", template: "%s — Orochia" },
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
    <html lang="en" className={`dark ${outfit.variable} ${jakarta.variable}`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-violet-600 selection:text-white">
        <JsonLd data={siteGraph()} />
        <AuthProvider>
          <AgeVerificationModal />
          <Navbar />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <footer className="border-t border-white/5 bg-zinc-950/80 backdrop-blur-xl py-12 text-xs text-zinc-500">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-white/5">
                <div className="text-center md:text-left">
                  <span className="text-base font-black tracking-wider text-white font-display">
                    OROCHIA<span className="text-violet-400">.</span>
                  </span>
                  <p className="mt-1 text-zinc-400 max-w-md text-xs">
                    The Sovereign Sanctuary for Independent Creators. 4K HLS Streams, Zero-Chargeback Crypto & Adult Rails.
                  </p>
                </div>

                {/* Navigation & Legal Links */}
                <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400">
                  <Link href="/codex" className="hover:text-violet-400 transition-colors">
                    The Codex (Lore)
                  </Link>
                  <Link href="/legal/terms" className="hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                  <Link href="/legal/privacy" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                  <Link href="/legal/2257" className="hover:text-white transition-colors">
                    18 U.S.C. § 2257 Notice
                  </Link>
                  <Link href="/legal/dmca" className="hover:text-white transition-colors">
                    DMCA / Takedowns
                  </Link>
                </div>
              </div>

              <div className="pt-8 text-center text-[11px] text-zinc-600">
                <p>© {new Date().getFullYear()} Orochia. Open-source software released under Apache-2.0. Built by Krizaka Core Team.</p>
                <p className="mt-1">All performers depicted on this website are 18 years of age or older.</p>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
