/**
 * The app's door to the Krizaka platform. Primitives come from @krizaka/ui (`Button`, `Badge`, `Field`, `Input`,
 * `Avatar`, `Skeleton`, `Loader`, `EmptyState` with its birds, `Tabs`, `Chip`, `ChipLink`, `Meter`, `Progress`,
 * `NumberTicker`, `Stepper`, `GlowCard`, `IsoHub`, the toasts, the theme…), charts from @krizaka/charts (under the
 * `Charts` provider), only the Orochia identity and composites (`orochiaButton`, `StatusBadge`, `SocialIcon`) from
 * @krizaka/orochia-design-system; the ones that carry words get them here, in the app's language (study §2.6 point 5).
 * A plain module: server components take `buttonVariants`, `orochiaButton` and `cn` from it too.
 */
export { orochiaButton } from "@krizaka/orochia-design-system/classes";
export { MotionObserver, OrochiaLogo, RotatingWord } from "@krizaka/ui";
export { Avatar } from "@krizaka/ui/avatar";
export { Badge, type BadgeProps,badgeVariants } from "@krizaka/ui/badge";
export { type ButtonVariants,buttonVariants } from "@krizaka/ui/button";
export { Card } from "@krizaka/ui/card";
export { Checkbox } from "@krizaka/ui/checkbox";
export { ChipLink } from "@krizaka/ui/chip-link";
// A filter that is an address is a `ChipLink` (server-safe); `Chip` is the client toggle.
export { Chip } from "@krizaka/ui/chip";
export { cn } from "@krizaka/ui/cn";
export { Command, CommandDialog } from "@krizaka/ui/command";
export { ConfirmButton } from "@krizaka/ui/confirm-button";
export { useCountdown } from "@krizaka/ui/countdown";
export { DropdownMenu } from "@krizaka/ui/dropdown-menu";
export { Field, Input, Select, Textarea } from "@krizaka/ui/field";
export { GlowCard } from "@krizaka/ui/glow-card";
export { IsoHub } from "@krizaka/ui/iso";
export { Kbd } from "@krizaka/ui/kbd";
export { Loader, LoadingRegion } from "@krizaka/ui/loader";
export { Mascot } from "@krizaka/ui/mascots";
export { Meter, type MeterPart, MeterValue } from "@krizaka/ui/meter";
export { Popover } from "@krizaka/ui/popover";
export { Progress } from "@krizaka/ui/progress";
export { RadioGroup } from "@krizaka/ui/radio-group";
export { SectionBackdrop } from "@krizaka/ui/section-backdrop";
export { Skeleton, SkeletonShape, SkeletonText } from "@krizaka/ui/skeleton";
export { Slider } from "@krizaka/ui/slider";
export { Switch } from "@krizaka/ui/switch";
export { Tabs } from "@krizaka/ui/tabs";
export { ThemeProvider, ThemeScript, useTheme } from "@krizaka/ui/theme";
export { toast } from "@krizaka/ui/toast";
// The app's words on the primitives that need them, and the Orochia composites (the kit: no primitive comes from it).
export { Button, type ButtonProps, type ButtonVariant, IconButton } from "./Button";
export {
  AlertDialog,
  Charts,
  Countdown,
  countdownUnits,
  DataTable,
  Dialog,
  groupedToast,
  Marquee,
  MoneyTicker,
  NumberTicker,
  Pagination,
  progressToast,
  Sheet,
  Stepper,
  ThemeToggle,
  Toaster,
  undoToast,
} from "./client";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { Spinner } from "./Spinner";
export { SocialIcon, StatusBadge, type StatusBadgeTone } from "@krizaka/orochia-design-system";
