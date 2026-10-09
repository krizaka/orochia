"use client";

import { Sheet as KitSheet } from "@krizaka/orochia-design-system";
import { Countdown as UiCountdown, type CountdownProps } from "@krizaka/ui/countdown";
import { ThemeToggle as UiThemeToggle, type ThemeToggleProps } from "@krizaka/ui/theme";
import React from "react";

import { t } from "@/lib/i18n";

/** The kit's Sheet with its close button named in the app's language. */
export function Sheet(props: React.ComponentProps<typeof KitSheet>) {
  return <KitSheet closeLabel={t("common.closeLabel")} {...props} />;
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
