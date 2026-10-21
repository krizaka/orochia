import "./globals.css";

import { ChartsProvider } from "@krizaka/charts/provider";
import { ThemeProvider, ThemeScript } from "@krizaka/ui/theme";
import type { Metadata } from "next";

import { AdminHeader } from "@/console/components/AdminHeader";
import { AdminSidebar } from "@/console/components/AdminSidebar";
import { currentAdmin } from "@/console/lib/account";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Orochia Admin — Control Plane",
  description: "Operator console for Orochia: 2257 creator verification, content reports, payouts and treasury.",
  robots: { index: false, follow: false },
};

/** Both themes: ThemeScript applies the persisted mode before the first paint (html.light), the header toggles it. */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-surface-0 text-fg antialiased">
        <ThemeProvider>
          {/* Every chart of the console in the Orochia palette (violet first), figures in en-US. */}
          <ChartsProvider brand="orochia" locale="en-US">
          {admin ? (
            <div className="flex min-h-screen">
              {/* The first Tab skips the sidebar's ten links (WCAG 2.4.1) — @krizaka/ui's SkipLink when it ships (krizaka/krizaka-ui#134). */}
              <a
                href="#content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-surface-1 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-fg focus:shadow-lg focus:outline-2 focus:outline-ring"
              >
                Skip to content
              </a>
              <AdminSidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <AdminHeader admin={admin} />
                <main id="content" tabIndex={-1} className="flex-1 overflow-y-auto p-6 outline-none md:p-8">{children}</main>
              </div>
            </div>
          ) : (
            children
          )}
          </ChartsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
