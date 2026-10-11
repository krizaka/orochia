import Link from "next/link";
import React from "react";

import { ChipLink, cn } from "@/components/ui";

/**
 * A tag as a link (`/explore?tag=…`): @krizaka/ui's `ChipLink`, so the filter is an address — the current filter is
 * selected (accent, `aria-current="page"`). `sm` is the compact chip of a card. A server component.
 */
export function TagChip({
  href,
  active = false,
  size = "md",
  className,
  children,
}: {
  href: string;
  active?: boolean;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <ChipLink asChild size="sm" selected={active} className={cn("gap-1", size === "sm" ? "h-6 px-2.5 text-[11px]" : "h-8 px-3", className)}>
      <Link href={href}>{children}</Link>
    </ChipLink>
  );
}
