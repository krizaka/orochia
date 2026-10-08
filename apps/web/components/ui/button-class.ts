import { cx } from "./cx";

/**
 * The classes of the app's buttons — variants and sizes with hover / focus-visible / active / disabled states that read
 * in both themes. A plain module (no "use client"), so server components can style a <Link> with it too.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "kz-sheen bg-linear-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white shadow-lg shadow-fuchsia-600/20 hover:brightness-110 active:brightness-95",
  secondary:
    "border border-white/10 bg-white/4 text-zinc-100 hover:border-white/20 hover:bg-white/8 light:border-black/10 light:bg-black/3 light:text-slate-800 hover:light:border-black/20 hover:light:bg-black/6",
  ghost: "text-zinc-300 hover:bg-white/6 hover:text-white light:text-slate-600 hover:light:bg-black/5 hover:light:text-slate-950",
  danger: "border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 light:text-rose-600",
};
const SIZES: Record<ButtonSize, string> = { sm: "h-8 gap-1.5 px-3 text-xs", md: "h-10 gap-2 px-4 text-sm", lg: "h-12 gap-2 px-6 text-sm" };

export function buttonClass({ variant = "secondary", size = "md", round = true, className }: { variant?: ButtonVariant; size?: ButtonSize; round?: boolean; className?: string } = {}) {
  return cx(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold transition-all duration-150",
    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus-visible:light:ring-offset-white",
    "disabled:pointer-events-none disabled:opacity-40",
    round ? "rounded-full" : "rounded-xl",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

