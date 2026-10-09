import { Rich as SharedRich, type RichProps } from "@krizaka/i18n/rich";
import type { ReactNode } from "react";

const bold = (children: ReactNode) => <strong className="font-semibold text-fg">{children}</strong>;

/**
 * Renders a message with <b>…</b> emphasis and {placeholders} replaced by nodes (links, …): `slots={{ email: … }}`.
 * The one implementation is @krizaka/i18n's; Orochia only gives the emphasis its classes.
 */
export function Rich(props: RichProps) {
  return <SharedRich renderBold={bold} {...props} />;
}
