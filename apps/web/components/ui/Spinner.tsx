"use client";

import { Spinner as UiSpinner, type SpinnerProps } from "@krizaka/ui/spinner";

import { useI18n } from "@/lib/i18n-client";

/** @krizaka/ui's Spinner, named "Loading…" unless the screen says what it waits for. */
export function Spinner({ label, ...props }: Omit<SpinnerProps, "label"> & { label?: string }) {
  const { t } = useI18n();
  return <UiSpinner label={label ?? t("common.loading")} {...props} />;
}
