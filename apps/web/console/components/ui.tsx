import { buttonVariants } from "@krizaka/ui/button";
import { Card } from "@krizaka/ui/card";
import { cn } from "@krizaka/ui/cn";
import { EmptyState } from "@krizaka/ui/empty-state";
import { PageHeader } from "@krizaka/ui/page-header";
import { Stat as KzStat } from "@krizaka/ui/stat";
import React from "react";

/** The console's page heading: the platform's PageHeader, with the room the screens expect below it. */
export function PageTitle({ title, subtitle, actions }: { title: string; subtitle: string; actions?: React.ReactNode }) {
  return <PageHeader title={title} description={subtitle} actions={actions} className="mb-8" />;
}

/** The status a figure carries (a status token: readable on both themes at this size). */
export type Tone = "default" | "success" | "warning" | "danger" | "accent";
export const toneText: Record<Tone, string> = {
  default: "",
  success: "text-fg-success",
  warning: "text-fg-warning",
  danger: "text-fg-danger",
  accent: "text-fg-accent",
};

/** A figure in a card: the platform's Stat inside an elevated Card. */
export function Stat({ label, value, hint, tone = "default" }: { label: string; value: React.ReactNode; hint?: string; tone?: Tone }) {
  return (
    <Card.Root tone="elevated">
      <Card.Body padding="md">
        <KzStat label={label} value={<span className={cn("font-mono", toneText[tone])}>{value}</span>} hint={hint} />
      </Card.Body>
    </Card.Root>
  );
}

/** Nothing to show: the platform's EmptyState (never sample data). */
export function Empty({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return <EmptyState title={children} icon={icon} />;
}

/** A table or a section: an elevated Card, large padding, scrolling sideways when the table is wider. */
export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Card.Root tone="elevated" radius="xl">
      <Card.Body padding="lg" className={cn("overflow-x-auto", className)}>
        {children}
      </Card.Body>
    </Card.Root>
  );
}

export const th = "py-2 pr-4 text-left text-[10px] uppercase tracking-wider text-fg-secondary font-semibold";
export const td = "py-2.5 pr-4 text-xs text-fg-secondary align-top";
/** Table bodies: a subtle rule between rows. */
export const tbody = "divide-y divide-border-subtle";
/** Strong text in a cell (a name, an amount). */
export const strong = "font-semibold text-fg";
/** Links to the consumer app. */
export const link = "text-fg-accent hover:underline";
/** Table and form actions: the platform's secondary button, small. */
export const button = buttonVariants({ variant: "secondary", size: "sm" });
/** A filter link: a small button, highlighted when it is the current one (aria-current). */
export const filter = (active: boolean) =>
  buttonVariants({ variant: active ? "primary" : "secondary", size: "sm", className: active ? undefined : "text-fg-secondary" });

export { cn };
