"use client";

import React from "react";
import { cx } from "./cx";

/** An on/off switch (role="switch"); `label` is its accessible name when no visible label sits next to it. */
export function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-30",
        checked ? "bg-violet-600" : "bg-zinc-700 light:bg-slate-300",
      )}
    >
      <span className={cx("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform", checked && "translate-x-5")} />
    </button>
  );
}
