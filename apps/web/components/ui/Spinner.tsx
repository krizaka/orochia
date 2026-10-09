import { Spinner as UiSpinner, type SpinnerProps } from "@krizaka/ui/spinner";

import { t } from "@/lib/i18n";

/** @krizaka/ui's Spinner, named "Loading…" unless the screen says what it waits for. */
export function Spinner({ label, ...props }: Omit<SpinnerProps, "label"> & { label?: string }) {
  return <UiSpinner label={label ?? t("common.loading")} {...props} />;
}
