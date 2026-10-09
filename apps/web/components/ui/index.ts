/**
 * The app's door to the Krizaka platform. Primitives come from @krizaka/ui (`Button`, `Badge`, `Field`, `Input`,
 * `Avatar`, `Skeleton`, `Spinner`, `EmptyState`, the theme…), the Orochia identity and composites from
 * @krizaka/orochia-design-system; the ones that carry words get them here, in the app's language (study §2.6 point 5).
 * A plain module: server components take `buttonVariants`, `orochiaButton` and `cn` from it too.
 */
export { cn } from "@krizaka/ui/cn";
export { buttonVariants, type ButtonVariants } from "@krizaka/ui/button";
export { orochiaButton } from "@krizaka/orochia-design-system/classes";
export { Badge, badgeVariants, type BadgeProps } from "@krizaka/ui/badge";
export { Field, Input, Select, Textarea } from "@krizaka/ui/field";
export { Avatar } from "@krizaka/ui/avatar";
export { Skeleton } from "@krizaka/ui/skeleton";
export { EmptyState } from "@krizaka/ui/empty-state";
export { ThemeProvider, ThemeScript, useTheme } from "@krizaka/ui/theme";
export { useCountdown } from "@krizaka/ui/countdown";
export { OrochiaLogo, MotionObserver, RotatingWord } from "@krizaka/ui";
// Kit composites, and the kit's deprecated controls kept until their @krizaka/ui primitive ships (chip, tabs, switch,
// slider, dialog, confirm-button — P3.2 / P5.1).
export { ConfirmIconButton, Chip, Segmented, Switch, Slider, SocialIcon, LiveBadge } from "@krizaka/orochia-design-system";
export { Button, IconButton, type ButtonProps, type ButtonVariant } from "./Button";
export { Spinner } from "./Spinner";
export { Sheet, Countdown, countdownUnits, ThemeToggle } from "./client";
