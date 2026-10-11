import { cn } from "@krizaka/ui/cn";
import { EmptyState as UiEmptyState, type EmptyStateProps as UiEmptyStateProps } from "@krizaka/ui/empty-state";
import { Mascot, type MascotBird, type MascotMood } from "@krizaka/ui/mascots";

export type EmptyStateProps = UiEmptyStateProps & {
  /**
   * A Krizaka bird above the words, in Orochia's violet — the bird carries a promise, never decoration: `flamingo` gets
   * paid (earnings, wallet), `pigeon` delivers (notifications, messages), `owl` reads (search, a feed to fill), `duck`
   * builds (a library to start), `falcon` watches (safety). One bird per idea.
   */
  bird?: MascotBird;
  /** The bird's moment: `empty` (nothing here yet, the default), `welcome`, `error`. */
  mood?: MascotMood;
};

/**
 * @krizaka/ui's EmptyState; with a `bird`, the mascot stands above the words (the primitive's icon slot is sized for a
 * glyph). Decorative: the words say what is empty.
 */
export function EmptyState({ bird, mood = "empty", className, ...props }: EmptyStateProps) {
  if (!bird) return <UiEmptyState className={className} {...props} />;
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed border-border-default pt-8", className)}>
      <Mascot bird={bird} mood={mood} size={88} />
      <UiEmptyState className="border-0 pt-2" {...props} />
    </div>
  );
}
