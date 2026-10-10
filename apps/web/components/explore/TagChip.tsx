import Link from "next/link";
import React from "react";

import { cn } from "@/components/ui";

/**
 * A tag as a link (`/explore?tag=…`): the look of the kit's `Chip` (pill, token borders, the accent when it is the
 * current filter), as an anchor so the filter is an address. Server-safe.
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
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex shrink-0 select-none items-center gap-1 whitespace-nowrap rounded-full border font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        size === "sm" ? "h-6 px-2.5 text-[11px]" : "h-8 px-3 text-xs",
        active
          ? "border-accent bg-accent-soft text-fg"
          : "border-border-default bg-surface-1 text-fg-secondary hover:border-border-strong hover:text-fg",
        className,
      )}
    >
      {children}
    </Link>
  );
}
