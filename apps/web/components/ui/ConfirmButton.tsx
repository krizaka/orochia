"use client";

import React, { useEffect, useState } from "react";
import { cx } from "./cx";

/**
 * A destructive icon action confirmed by a second tap (never `window.confirm`): the first tap arms it and spells out
 * what will happen, the second runs it; it disarms by itself after a few seconds or when focus leaves.
 */
export function ConfirmIconButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
  className,
  children,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={armed ? confirmLabel : label}
      title={armed ? confirmLabel : label}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onConfirm();
      }}
      className={cx(
        "inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-40",
        armed
          ? "bg-rose-600 text-white hover:bg-rose-500"
          : "text-zinc-400 hover:bg-rose-500/10 hover:text-rose-300 light:text-slate-500 light:hover:text-rose-600",
        className,
      )}
    >
      {children}
      {armed && <span>{confirmLabel}</span>}
    </button>
  );
}
