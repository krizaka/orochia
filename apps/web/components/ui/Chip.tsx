"use client";

import React from "react";
import { cx } from "./cx";

/** A toggleable pill (speed, options): pressed state announced, readable in both themes. */
export function Chip({ active, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...rest}
      className={cx(
        "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-40",
        active
          ? "border-violet-500 bg-violet-600/20 text-violet-100 light:text-violet-800"
          : "border-white/10 text-zinc-300 hover:border-white/25 hover:text-white light:border-black/10 light:text-slate-600 light:hover:border-black/25 light:hover:text-slate-950",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** One choice among a few, as a segmented control (radio semantics). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: React.ReactNode; disabled?: boolean }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1 rounded-2xl border border-white/10 p-1 light:border-black/10" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex min-h-9 items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-30",
            value === o.value ? "bg-violet-600 text-white shadow" : "text-zinc-400 hover:bg-white/5 hover:text-white light:text-slate-600 light:hover:bg-black/5 light:hover:text-slate-950",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
