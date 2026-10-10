import { ChevronRightIcon } from "@krizaka/icons";
import Link from "next/link";
import React from "react";

/**
 * The head of a home section: an icon tile, the title (an anchor target: `/#<id>`), an optional line under it and the
 * "see all" link. One shape for auctions, challenges and the feed, signed in or not.
 */
export function HomeSectionHeader({
  id,
  icon,
  title,
  body,
  href,
  linkLabel,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  body?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div data-reveal className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 items-center gap-3.5">
        <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-default bg-accent-soft text-fg-accent">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 id={id} className="scroll-mt-24 font-display text-2xl font-bold text-fg sm:text-[1.7rem]">
            {title}
          </h2>
          {body && <p className="mt-0.5 text-sm text-fg-secondary">{body}</p>}
        </div>
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1 rounded-full px-1 py-1 text-sm font-semibold text-fg-accent transition-colors hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          {linkLabel}
          <ChevronRightIcon size={16} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
