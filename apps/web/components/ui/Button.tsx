"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white shadow-lg shadow-fuchsia-600/20 hover:brightness-110 active:brightness-95",
  secondary:
    "border border-white/10 bg-white/[0.04] text-zinc-100 hover:border-white/20 hover:bg-white/[0.08] light:border-black/10 light:bg-black/[0.03] light:text-slate-800 light:hover:border-black/20 light:hover:bg-black/[0.06]",
  ghost: "text-zinc-300 hover:bg-white/[0.06] hover:text-white light:text-slate-600 light:hover:bg-black/[0.05] light:hover:text-slate-950",
  danger: "border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 light:text-rose-600",
};
const SIZES: Record<Size, string> = { sm: "h-8 gap-1.5 px-3 text-xs", md: "h-10 gap-2 px-4 text-sm", lg: "h-12 gap-2 px-6 text-sm" };

/**
 * The one button of the app: variants and sizes, hover / focus-visible / active / disabled / loading states that
 * read in both themes. Pass `href` through `asChild`-free composition: wrap a <Link> with `buttonClass(...)`.
 */
export function buttonClass({ variant = "secondary", size = "md", round = true, className }: { variant?: Variant; size?: Size; round?: boolean; className?: string } = {}) {
  return cx(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 light:focus-visible:ring-offset-white",
    "disabled:pointer-events-none disabled:opacity-40",
    round ? "rounded-full" : "rounded-xl",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant,
  size,
  round,
  loading = false,
  icon,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; round?: boolean; loading?: boolean; icon?: React.ReactNode }) {
  return (
    <button type="button" {...rest} disabled={rest.disabled || loading} aria-busy={loading || undefined} className={buttonClass({ variant, size, round, className })}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/** A square icon-only button; `label` is its accessible name (and tooltip). */
export function IconButton({ label, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-40 light:text-slate-600 light:hover:bg-black/[0.06] light:hover:text-slate-950",
        className,
      )}
    >
      {children}
    </button>
  );
}
