import { orochiaButton } from "@krizaka/orochia-design-system/classes";
import { Button as UiButton, type ButtonProps as UiButtonProps, IconButton as UiIconButton, type IconButtonProps as UiIconButtonProps } from "@krizaka/ui/button";

/** The variants of @krizaka/ui's Button, plus Orochia's gradient call to action (`sensual`, from the kit). */
export type ButtonVariant = NonNullable<UiButtonProps["variant"]> | "sensual";

export type ButtonProps = Omit<UiButtonProps, "variant"> & { variant?: ButtonVariant };

/**
 * @krizaka/ui's Button with Orochia's defaults: pill-shaped (the product's buttons always were) and `sensual` for the
 * gradient call to action. Everything else is the platform's: `loading` draws the Krizaka loader glyph (with `progress`
 * for an upload), `status` ends the wait with a check or a cross (and `announce` says it), `shimmer` / `magnetic` mark
 * the one action a page is about — sparingly. Server-safe: no hook, no client directive.
 */
export function Button({ variant, shape = "pill", size, asChild, className, ...props }: ButtonProps) {
  const sensual = variant === "sensual";
  return (
    <UiButton
      variant={sensual ? "primary" : variant}
      shape={shape}
      size={size}
      asChild={asChild}
      className={sensual ? orochiaButton({ variant: "sensual", size, shape: shape === "cut" ? undefined : shape, className }) : className}
      {...props}
    />
  );
}

/** An icon-only button (`label` is its accessible name and tooltip): quiet and round by default. */
export function IconButton({ variant = "ghost", shape = "pill", ...props }: UiIconButtonProps) {
  return <UiIconButton variant={variant} shape={shape} {...props} />;
}
