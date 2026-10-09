import { orochiaButton } from "@krizaka/orochia-design-system/classes";
import { Button as UiButton, type ButtonProps as UiButtonProps, IconButton as UiIconButton, type IconButtonProps as UiIconButtonProps } from "@krizaka/ui/button";
import { Spinner as UiSpinner } from "@krizaka/ui/spinner";

import { t } from "@/lib/i18n";

/** The variants of @krizaka/ui's Button, plus Orochia's gradient call to action (`sensual`, from the kit). */
export type ButtonVariant = NonNullable<UiButtonProps["variant"]> | "sensual";

export type ButtonProps = Omit<UiButtonProps, "variant"> & { variant?: ButtonVariant };

/**
 * @krizaka/ui's Button with Orochia's defaults: pill-shaped (the product's buttons always were), `sensual` for the
 * gradient call to action, and a translated spinner while `loading`. Server-safe: no hook, no client directive.
 */
export function Button({ variant, shape = "pill", size, loading, asChild, className, children, ...props }: ButtonProps) {
  const sensual = variant === "sensual";
  return (
    <UiButton
      variant={sensual ? "primary" : variant}
      shape={shape}
      size={size}
      loading={loading}
      asChild={asChild}
      className={sensual ? orochiaButton({ variant: "sensual", size, shape, className }) : className}
      {...props}
    >
      {loading && !asChild ? (
        <>
          <UiSpinner size="sm" label={t("common.loading")} className="text-current" />
          {children}
        </>
      ) : (
        children
      )}
    </UiButton>
  );
}

/** An icon-only button (`label` is its accessible name and tooltip): quiet and round by default. */
export function IconButton({ variant = "ghost", shape = "pill", ...props }: UiIconButtonProps) {
  return <UiIconButton variant={variant} shape={shape} {...props} />;
}
