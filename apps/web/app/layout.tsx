import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orochia — Adult-Friendly Open-Source Video & Creator Platform",
  description:
    "High-performance open-source video streaming and creator community powered by Bunny.net Stream API and adult-compliant payment gateways.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-violet-600 selection:text-white">
        <Navbar />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <footer className="border-t border-white/5 bg-zinc-950 py-10 text-center text-xs text-zinc-500">
          <div className="mx-auto max-w-7xl px-4">
            <p className="font-semibold text-zinc-400">
              OROCHIA — An Open-Source Creator Platform by Krizaka
            </p>
            <p className="mt-1">
              Built with Next.js App Router, PostgreSQL, Drizzle ORM, Bunny.net Stream, and CCBill / Crypto gateways.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
