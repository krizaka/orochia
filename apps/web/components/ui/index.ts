/**
 * The app's door to the Krizaka platform. Primitives come from @krizaka/ui (`Button`, `Badge`, `Field`, `Input`,
 * `Avatar`, `Skeleton`, `Spinner`, `EmptyState`, the theme…), the Orochia identity and composites from
 * @krizaka/orochia-design-system; the ones that carry words get them here, in the app's language (study §2.6 point 5).
 * A plain module: server components take `buttonVariants`, `orochiaButton` and `cn` from it too.
 */
export { orochiaButton } from "@krizaka/orochia-design-system/classes";
export { MotionObserver, OrochiaLogo, RotatingWord } from "@krizaka/ui";
export { Avatar } from "@krizaka/ui/avatar";
export { Badge, type BadgeProps,badgeVariants } from "@krizaka/ui/badge";
export { type ButtonVariants,buttonVariants } from "@krizaka/ui/button";
export { Card } from "@krizaka/ui/card";
export { cn } from "@krizaka/ui/cn";
export { useCountdown } from "@krizaka/ui/countdown";
export { EmptyState } from "@krizaka/ui/empty-state";
export { Field, Input, Select, Textarea } from "@krizaka/ui/field";
export { Kbd } from "@krizaka/ui/kbd";
export { Popover } from "@krizaka/ui/popover";
export { Skeleton } from "@krizaka/ui/skeleton";
export { ThemeProvider, ThemeScript, useTheme } from "@krizaka/ui/theme";
export { toast } from "@krizaka/ui/toast";
// Kit composites, and the kit's deprecated controls kept until their @krizaka/ui primitive ships (chip, tabs, switch,
// slider, confirm-button — P5.1).
export { Button, type ButtonProps, type ButtonVariant,IconButton } from "./Button";
export { AlertDialog, Countdown, countdownUnits, Dialog, Sheet, ThemeToggle, Toaster } from "./client";
export { Spinner } from "./Spinner";
export { Chip, ConfirmIconButton, LiveBadge,Segmented, Slider, SocialIcon, Switch } from "@krizaka/orochia-design-system";
