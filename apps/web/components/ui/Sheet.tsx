"use client";

import React from "react";
import { Sheet as KitSheet } from "@krizaka/orochia-design-system";
import { t } from "@/lib/i18n";

/** The kit's Sheet with its close button named in the app's language. */
export function Sheet(props: React.ComponentProps<typeof KitSheet>) {
  return <KitSheet closeLabel={t("common.closeLabel")} {...props} />;
}
