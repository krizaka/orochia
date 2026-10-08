"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cx } from "./cx";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button-class";

/** The one button of the app (loading state included); its classes come from buttonClass. */
export function Button({
  variant,
  size,
  round,
  loading = false,
  icon,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize; round?: boolean; loading?: boolean; icon?: React.ReactNode }) {
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
