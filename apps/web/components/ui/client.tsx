"use client";

import { ChartsProvider } from "@krizaka/charts/provider";
import { Countdown as UiCountdown, type CountdownProps } from "@krizaka/ui/countdown";
import { DataTable as UiDataTable, type DataTableProps } from "@krizaka/ui/data-table";
import {
  AlertDialog as UiAlertDialog,
  type AlertDialogProps,
  Dialog as UiDialog,
  DialogContent as UiDialogContent,
  type DialogContentProps,
  Sheet as UiSheet,
  type SheetProps,
} from "@krizaka/ui/dialog";
import { Marquee as UiMarquee, type MarqueeProps } from "@krizaka/ui/marquee";
import { NumberTicker as UiNumberTicker, type NumberTickerProps } from "@krizaka/ui/number-ticker";
import { Pagination as UiPagination, type PaginationProps } from "@krizaka/ui/pagination";
import { Stepper as UiStepper, type StepperProps } from "@krizaka/ui/stepper";
import { ThemeToggle as UiThemeToggle, type ThemeToggleProps } from "@krizaka/ui/theme";
import {
  groupedToast as uiGroupedToast,
  type GroupedToastOptions,
  progressToast as uiProgressToast,
  type ProgressToastOptions,
  Toaster as UiToaster,
  type ToasterProps,
  undoToast as uiUndoToast,
  type UndoToastOptions,
} from "@krizaka/ui/toast";
import React from "react";

import { currentLocale, t } from "@/lib/i18n";

type Labelled<P> = Omit<P, "closeLabel"> & { closeLabel?: string };

/**
 * On close, focus goes back to what opened the dialog (WCAG 2.4.3). Radix only gives it back to a `Dialog.Trigger`;
 * the app's dialogs are controlled and opened by buttons outside (the tip, report, save…), so without this the focus
 * fell to <body>. The opener is what has the focus when the content opens (before Radix moves it inside).
 * Moves into @krizaka/ui's DialogContent and Sheet (krizaka/krizaka-ui#133).
 */
type AutoFocus = ((event: Event) => void) | undefined;
function useReturnFocus(onOpenAutoFocus: AutoFocus, onCloseAutoFocus: AutoFocus) {
  const opener = React.useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      const active = document.activeElement as HTMLElement | null;
      opener.current = active && active !== document.body ? active : null;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      const target = opener.current;
      opener.current = null;
      if (event.defaultPrevented || !target?.isConnected) return;
      event.preventDefault();
      target.focus();
    },
  };
}

/** @krizaka/ui's dialog content with its close button named in the app's language. */
function DialogContent({ onOpenAutoFocus, onCloseAutoFocus, ...props }: Labelled<DialogContentProps>) {
  const focus = useReturnFocus(onOpenAutoFocus, onCloseAutoFocus);
  return <UiDialogContent closeLabel={t("common.closeLabel")} {...focus} {...props} />;
}

/** `Dialog.Root/Trigger/Content/Header/Title/Description/Body/Footer/Close` — `Content` knows the app's close label. */
export const Dialog = { ...UiDialog, Content: DialogContent };

/** A sheet (a dialog anchored at the bottom on a phone, centred from `sm` up), close button named in the app's language. */
export function Sheet({ onOpenAutoFocus, onCloseAutoFocus, ...props }: Labelled<SheetProps>) {
  const focus = useReturnFocus(onOpenAutoFocus, onCloseAutoFocus);
  return <UiSheet closeLabel={t("common.closeLabel")} {...focus} {...(props as SheetProps)} />;
}

/** A confirmation (Radix AlertDialog): Cancel is named by the app unless the screen says otherwise. */
export function AlertDialog({ cancelLabel, ...props }: Omit<AlertDialogProps, "cancelLabel"> & { cancelLabel?: string }) {
  return <UiAlertDialog cancelLabel={cancelLabel ?? t("common.cancel")} {...props} />;
}

/** The toasts' region, mounted once in the layout, named in the app's language. */
export function Toaster(props: Omit<ToasterProps, "label" | "closeLabel">) {
  return <UiToaster label={t("notifications.region")} closeLabel={t("notifications.dismiss")} {...props} />;
}

/**
 * “Removed — Undo”: the action waits (6 s, paused while hovered) before it becomes final. `onCommit` makes it final,
 * `onUndo` puts things back; the undo button is named by the app.
 */
export function undoToast(message: React.ReactNode, options: Omit<UndoToastOptions, "undoLabel"> & { undoLabel?: string }) {
  return uiUndoToast(message, { undoLabel: t("common.undo"), ...options });
}

/** A long task in one toast that advances (an upload): call it again with the returned `id`. */
export const progressToast = (message: React.ReactNode, options: ProgressToastOptions) => uiProgressToast(message, options);

/** The same event again and again folds into one toast that counts (“3 new tips”). */
export const groupedToast = (key: string, message: React.ReactNode, options?: GroupedToastOptions) => uiGroupedToast(key, message, options);

/** The short unit labels of every countdown (d, h, m, s), in the app's language. */
export const countdownUnits = () => ({ d: t("auction.units.d"), h: t("auction.units.h"), m: t("auction.units.m"), s: t("auction.units.s") });

/** @krizaka/ui's Countdown with the app's unit labels. */
export function Countdown({ units, ...props }: Omit<CountdownProps, "units"> & { units?: CountdownProps["units"] }) {
  return <UiCountdown units={units ?? countdownUnits()} {...props} />;
}

/** A figure that climbs into view (or, `trigger="change"`, rolls digit by digit to each new value), in the reader's locale. */
export function NumberTicker(props: Omit<NumberTickerProps, "locale">) {
  return <UiNumberTicker locale={currentLocale()} {...props} />;
}

/** An amount of US cents that rolls to each new value (a current bid, a pot): the digits move, the reader hears it once. */
export function MoneyTicker({ cents, ...props }: Omit<NumberTickerProps, "locale" | "value" | "format"> & { cents: number }) {
  return <UiNumberTicker locale={currentLocale()} value={cents / 100} format={{ style: "currency", currency: "USD" }} {...props} />;
}

/** A table of records (sort, cards on a phone, loading / empty states) with the app's words. */
export function DataTable<T extends object>(props: DataTableProps<T>) {
  return (
    <UiDataTable
      {...props}
      labels={{
        selectAll: t("table.selectAll"),
        selectRow: (name) => t("table.selectRow", { name }),
        loading: t("common.loading"),
        empty: t("table.empty"),
        ...props.labels,
      }}
    />
  );
}

/** Pages of a list, named in the app's language; the page lives in the address (`getHref`) or the screen's state. */
export function Pagination(props: PaginationProps) {
  return (
    <UiPagination
      {...props}
      labels={{
        nav: t("table.pages"),
        previous: t("table.previous"),
        next: t("table.next"),
        page: (page) => t("table.page", { page }),
        compact: (page, count) => t("table.pageOf", { page, count }),
        pageSize: t("table.pageSize"),
        ...props.labels,
      }}
    />
  );
}

/** The steps of a task, each state said in the app's words. */
export function Stepper(props: Omit<StepperProps, "labels">) {
  return <UiStepper labels={{ done: t("common.steps.done"), current: t("common.steps.current"), upcoming: t("common.steps.upcoming"), error: t("common.steps.error") }} {...props} />;
}

/** A band sliding forever, its pause button named in the app's language. */
export function Marquee(props: Omit<MarqueeProps, "pauseLabel" | "playLabel">) {
  return <UiMarquee pauseLabel={t("common.pauseBand")} playLabel={t("common.playBand")} {...props} />;
}

/** Every chart below it speaks the app's words and wears the Orochia palette (violet first). Mounted once in the layout. */
export function Charts({ children }: { children: React.ReactNode }) {
  return (
    <ChartsProvider
      locale={currentLocale()}
      brand="orochia"
      labels={{
        showData: t("charts.showData"),
        hideData: t("charts.hideData"),
        tableCaption: t("charts.tableCaption"),
        loading: t("charts.loading"),
        empty: t("charts.empty"),
        error: t("charts.error"),
        exportCsv: t("charts.exportCsv"),
        exportPng: t("charts.exportPng"),
        exportSvg: t("charts.exportSvg"),
      }}
    >
      {children}
    </ChartsProvider>
  );
}

/** @krizaka/ui's theme toggle (dark → light → system, persisted as `kz-theme`), named for what the next tap does. */
export function ThemeToggle(props: Omit<ThemeToggleProps, "label">) {
  return (
    <UiThemeToggle
      variant="ghost"
      shape="pill"
      label={(mode) => (mode === "dark" ? t("theme.toLight") : mode === "light" ? t("theme.toSystem") : t("theme.toDark"))}
      {...props}
    />
  );
}
