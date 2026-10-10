import { ChevronRightIcon } from "@krizaka/icons";
import Link from "next/link";
import React from "react";

import { buttonVariants, cn, EmptyState } from "@/components/ui";

export interface SectionCta {
  href: string;
  label: string;
}

/**
 * A section of Explore: an icon, a title and a line under it, an optional "See all" — and, when it has nothing to
 * show, a designed empty state that says why and offers the next step (never a blank space).
 */
export function ExploreSection({
  id,
  icon,
  title,
  description,
  seeAll,
  empty,
  isEmpty,
  children,
  index = 0,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  seeAll?: SectionCta;
  empty: { title: string; description: string; cta: SectionCta };
  isEmpty: boolean;
  children?: React.ReactNode;
  index?: number;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24" data-reveal style={{ ["--kz-delay" as string]: `${Math.min(index, 4) * 60}ms` }}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent" aria-hidden>
            {icon}
          </span>
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="font-display text-lg font-black tracking-tight text-fg sm:text-xl">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-fg-secondary sm:text-sm">{description}</p>
          </div>
        </div>
        {seeAll && !isEmpty && (
          <Link href={seeAll.href} className={cn(buttonVariants({ variant: "ghost", size: "sm", shape: "rounded" }), "shrink-0 gap-1 text-xs")}>
            {seeAll.label}
            <ChevronRightIcon size={14} />
          </Link>
        )}
      </div>
      {isEmpty ? (
        <EmptyState
          icon={icon}
          title={empty.title}
          description={empty.description}
          className="rounded-3xl bg-surface-1/40 py-12"
          action={
            <Link href={empty.cta.href} className={buttonVariants({ variant: "secondary", size: "sm", shape: "rounded" })}>
              {empty.cta.label}
            </Link>
          }
        />
      ) : (
        children
      )}
    </section>
  );
}

/**
 * A row of cards: swiped sideways on a phone (snapping, the next card peeking), a grid from `sm` up.
 * `columns` is the number of columns on large screens.
 */
export function CardRail({ children, columns = 4, label }: { children: React.ReactNode; columns?: 4 | 6; label: string }) {
  return (
    <div
      role="list"
      aria-label={label}
      className={cn(
        "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0",
        columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-6",
      )}
    >
      {React.Children.map(children, (child) => (
        <div role="listitem" className={cn("shrink-0 snap-start sm:w-auto", columns === 4 ? "w-[78%]" : "w-[40%]")}>
          {child}
        </div>
      ))}
    </div>
  );
}
