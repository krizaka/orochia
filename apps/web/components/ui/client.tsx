"use client";

import { Countdown as UiCountdown, type CountdownProps } from "@krizaka/ui/countdown";
import {
  AlertDialog as UiAlertDialog,
  type AlertDialogProps,
  Dialog as UiDialog,
  DialogContent as UiDialogContent,
  type DialogContentProps,
  Sheet as UiSheet,
  type SheetProps,
} from "@krizaka/ui/dialog";
import { ThemeToggle as UiThemeToggle, type ThemeToggleProps } from "@krizaka/ui/theme";
import { Toaster as UiToaster, type ToasterProps } from "@krizaka/ui/toast";
import React from "react";

import { t } from "@/lib/i18n";

type Labelled<P> = Omit<P, "closeLabel"> & { closeLabel?: string };

/** @krizaka/ui's dialog content with its close button named in the app's language. */
function DialogContent(props: Labelled<DialogContentProps>) {
  return <UiDialogContent closeLabel={t("common.closeLabel")} {...props} />;
}

/** `Dialog.Root/Trigger/Content/Header/Title/Description/Body/Footer/Close` — `Content` knows the app's close label. */
export const Dialog = { ...UiDialog, Content: DialogContent };

/** A sheet (a dialog anchored at the bottom on a phone, centred from `sm` up), close button named in the app's language. */
export function Sheet(props: Labelled<SheetProps>) {
  return <UiSheet closeLabel={t("common.closeLabel")} {...props} />;
}

/** A confirmation (Radix AlertDialog): Cancel is named by the app unless the screen says otherwise. */
export function AlertDialog({ cancelLabel, ...props }: Omit<AlertDialogProps, "cancelLabel"> & { cancelLabel?: string }) {
  return <UiAlertDialog cancelLabel={cancelLabel ?? t("common.cancel")} {...props} />;
}

/** The toasts' region, mounted once in the layout, named in the app's language. */
export function Toaster(props: Omit<ToasterProps, "label" | "closeLabel">) {
  return <UiToaster label={t("notifications.region")} closeLabel={t("notifications.dismiss")} {...props} />;
}

/** The short unit labels of every countdown (d, h, m, s), in the app's language. */
export const countdownUnits = () => ({ d: t("auction.units.d"), h: t("auction.units.h"), m: t("auction.units.m"), s: t("auction.units.s") });

/** @krizaka/ui's Countdown with the app's unit labels. */
export function Countdown({ units, ...props }: Omit<CountdownProps, "units"> & { units?: CountdownProps["units"] }) {
  return <UiCountdown units={units ?? countdownUnits()} {...props} />;
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
