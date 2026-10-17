import type { Metadata } from "next";

import { MeShell } from "@/components/me/MeShell";
import { NOINDEX } from "@/lib/seo";

/** The private space (/me/…): out of every index; its public face is /@handle. */
export const metadata: Metadata = { robots: NOINDEX };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MeShell>{children}</MeShell>;
}
