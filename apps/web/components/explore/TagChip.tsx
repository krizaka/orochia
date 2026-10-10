"use client";

import Link from "next/link";
import React from "react";

import { chipVariants, cn } from "@/components/ui";

/**
 * A tag as a link (`/explore?tag=…`): @krizaka/ui's chip, as an anchor so the filter is an address — the current
 * filter is the chip's "on" state (accent). `sm` is the compact chip of a card. A client component only because
 * `chip` comes from a client module: back to the server with `Chip asChild` (krizaka/krizaka-ui#45).
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
      data-state={active ? "on" : "off"}
      className={chipVariants({ size: "sm" }).base({ className: cn("gap-1", size === "sm" ? "h-6 px-2.5 text-[11px]" : "h-8 px-3", className) })}
    >
      {children}
    </Link>
  );
}
