import "./globals.css";

import { ChartsProvider } from "@krizaka/charts/provider";
import { ThemeProvider, ThemeScript } from "@krizaka/ui/theme";
import type { Metadata } from "next";

import { ConsoleShell } from "@/console/components/ConsoleShell";
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
    <html lang="en" data-surface="product" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen bg-surface-0 text-fg antialiased">
        <ThemeProvider>
          {/* Every chart of the console in the Orochia palette (violet first), figures in en-US. */}
          <ChartsProvider brand="orochia" locale="en-US">
          {admin ? <ConsoleShell admin={admin}>{children}</ConsoleShell> : children}
          </ChartsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
