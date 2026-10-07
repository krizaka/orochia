import type { Metadata } from "next";
import { NOINDEX } from "@/lib/seo";

/** Account pages stay out of every index (robots.txt disallows them too). */
export const metadata: Metadata = { robots: NOINDEX };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
