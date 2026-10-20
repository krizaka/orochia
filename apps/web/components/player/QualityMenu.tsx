"use client";

import { Check, Settings } from "lucide-react";
import React, { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";
import { AUTO, menuKeyStep, type QualityOption } from "@/lib/player-quality";

interface QualityMenuProps {
  options: QualityOption[];
  /** The chosen option's id (`auto` or a height). */
  value: string;
  onSelect: (option: QualityOption) => void;
  /** What Auto plays right now (lines), said beside « Auto ». */
  autoHeight?: number | null;
  /** The device picks by itself (native HLS with no variants to offer): the menu says so instead of pretending. */
  native?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  /** Extra classes of the panel (the player caps its height in a short frame). */
  panelClassName?: string;
}

/**
 * The quality picker: a button naming the current quality and a menu of radio items (Auto, then each rendition).
 * Built here, inside the player, because the player may be the full-screen element and a portal outside it would
 * not show. Keyboard: Enter / Space / ArrowDown opens, arrows · Home · End move, Enter picks, Escape closes and
 * gives the focus back to the button.
 */
export function QualityMenu({ options, value, onSelect, autoHeight, native = false, onOpenChange, defaultOpen = false, panelClassName }: QualityMenuProps) {
  const { t } = useI18n();
  const [open, setOpenState] = useState(defaultOpen);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };

  const checkedIndex = Math.max(0, options.findIndex((o) => o.id === value));
  const current = options.find((o) => o.id === value) ?? options[0];
  const labelOf = (o: QualityOption) => (o.id === AUTO ? t("player.quality.auto") : o.label);
  const currentLabel = current ? labelOf(current) : t("player.quality.auto");

  // Opening puts the focus on the chosen item; a click or a tap outside closes.
  useEffect(() => {
    if (!open) return;
    itemRefs.current[checkedIndex]?.focus();
    const away = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (options.length === 0 && !native) return null;

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    const at = itemRefs.current.findIndex((el) => el === document.activeElement);
    const next = menuKeyStep(e.key, at < 0 ? checkedIndex : at, options.length);
    if (next !== null) {
      e.preventDefault();
      itemRefs.current[next]?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative" data-testid="quality-menu">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("player.quality.button", { value: currentLabel })}
        title={t("player.quality.menu")}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex h-11 touch-manipulation items-center gap-1.5 rounded-lg px-2 text-current hover:bg-accent-soft hover:text-fg-accent focus-visible:outline-2 focus-visible:outline-accent sm:h-8"
      >
        <Settings className="h-5 w-5" aria-hidden />
        <span className="font-mono text-xs" aria-hidden>{currentLabel}</span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t("player.quality.menu")}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute bottom-full right-0 z-40 mb-2 min-w-40 max-w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-fg-on-media/15 bg-scrim-strong p-1 text-fg-on-media shadow-xl backdrop-blur-md",
            panelClassName,
          )}
        >
          {options.map((o, i) => (
            <button
              key={o.id}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={o.id === current?.id}
              data-quality={o.id}
              tabIndex={i === checkedIndex ? 0 : -1}
              onClick={() => {
                onSelect(o);
                close(true);
              }}
              className="flex h-9 w-full touch-manipulation items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Check className={cn("size-4 shrink-0", o.id === current?.id ? "opacity-100" : "opacity-0")} aria-hidden />
              <span className="flex-1">{o.id === AUTO && autoHeight ? t("player.quality.autoNow", { height: autoHeight }) : labelOf(o)}</span>
              {o.badge && (
                <span data-testid="quality-badge" className="rounded-md bg-fg-on-media/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                  {o.badge}
                </span>
              )}
            </button>
          ))}
          {options.length === 0 && native && (
            <p role="note" className="px-2 py-1.5 text-xs text-fg-on-media/80">
              {t("player.quality.native")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
