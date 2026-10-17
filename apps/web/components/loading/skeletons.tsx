import { MediaGridSkeleton } from "@krizaka/ui/media-grid";

import { cn, Skeleton } from "@/components/ui";
import { t } from "@/lib/i18n";

/**
 * What a route shows the instant it is opened, while its server data is read (the `loading.tsx` files): the shapes of the
 * real page on @krizaka/ui's Skeleton — the same frames (16:9 and 9:16 cards, the player, the avatar), so nothing moves
 * when the content arrives. One polite announcement per page; the shapes are hidden from assistive technology.
 */

const CONTAINER = "mx-auto w-full max-w-7xl px-4 sm:px-6";

function Announce({ label }: { label: string }) {
  return (
    <span role="status" className="sr-only">
      {label}
    </span>
  );
}

/** Home and Explore: the tabs, then a Shorts shelf and the grid. */
export function FeedSkeleton() {
  return (
    <div aria-busy="true" className="w-full overflow-x-clip">
      <div className={cn(CONTAINER, "py-6 sm:py-8")}>
        <div aria-hidden className="mb-6 flex items-center justify-between gap-4 border-b border-border-default pb-4">
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-9 w-24 rounded-full" />
            ))}
          </div>
          <Skeleton className="hidden h-8 w-16 rounded-lg sm:block" />
        </div>
        <MediaGridSkeleton label={t("feed.loadingVideos")} count={8} shelfCount={4} />
      </div>
    </div>
  );
}

/** The watch page: the 16:9 player, the title, the creator, the actions, and the next videos beside it. */
export function WatchSkeleton() {
  return (
    <div aria-busy="true" className={cn(CONTAINER, "grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_22rem]")}>
      <Announce label={t("watch.loading")} />
      <div aria-hidden className="min-w-0">
        <Skeleton shape="rect" className="aspect-video h-auto w-full rounded-2xl" />
        <Skeleton className="mt-4 h-6 w-3/4" />
        <div className="mt-4 flex items-center gap-3">
          <Skeleton shape="circle" className="h-11 w-11" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
        <div className="mt-4 flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-full" />
          ))}
        </div>
      </div>
      <ul aria-hidden className="m-0 flex list-none flex-col gap-3 p-0">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex gap-3">
            <Skeleton shape="rect" className="aspect-video h-auto w-40 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-3" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A creator's profile: banner, avatar, name, stats, then their videos. */
export function ProfileSkeleton() {
  return (
    <div aria-busy="true" className={cn(CONTAINER, "py-8")}>
      <div aria-hidden>
        <Skeleton shape="rect" className="h-32 w-full rounded-2xl sm:h-48" />
        <div className="-mt-10 flex items-end gap-4 px-4 sm:px-6">
          <Skeleton shape="circle" className="h-20 w-20 shrink-0 ring-4 ring-surface-0 sm:h-24 sm:w-24" />
          <div className="mb-2 flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <div className="mt-6 flex gap-6 px-4 sm:px-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-16" />
          ))}
        </div>
      </div>
      <MediaGridSkeleton className="mt-8" label={t("profile.loading")} count={6} shelfCount={0} />
    </div>
  );
}

/** Insights and dashboards: a header and a few blocks of figures and lines. */
export function BlocksSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <Announce label={label} />
      <div aria-hidden className="grid gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-3 w-80 max-w-full" />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} shape="rect" className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton shape="rect" className="h-64 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton shape="rect" className="h-40 rounded-2xl" />
          <Skeleton shape="rect" className="h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
