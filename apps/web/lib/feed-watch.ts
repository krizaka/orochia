/**
 * Times the slide in view of the vertical feed: when it changes (or the page is left), the one that left is reported with how
 * much of it was watched and how long it was in view. Clock, ids and transport are injected, so the rule is a unit test.
 */
export interface WatchReport {
  videoId: string;
  visit: string;
  watchedPct: number;
  dwellMs: number;
}

export function createWatchTracker({ now, uuid, send }: { now: () => number; uuid: () => string; send: (report: WatchReport, leaving: boolean) => void }) {
  let look: { id: string; visit: string; start: number; maxRatio: number } | null = null;
  const finish = (leaving: boolean) => {
    if (!look) return;
    send({ videoId: look.id, visit: look.visit, watchedPct: Math.min(100, look.maxRatio * 100), dwellMs: Math.round(now() - look.start) }, leaving);
  };
  return {
    /** A slide is in view; the same one again changes nothing. */
    begin(id: string) {
      if (look?.id === id) return;
      finish(false);
      look = { id, visit: uuid(), start: now(), maxRatio: 0 };
    },
    /** How far the playing video of the slide has got (0–1). */
    progress(ratio: number) {
      if (look && Number.isFinite(ratio)) look.maxRatio = Math.max(look.maxRatio, Math.min(1, Math.max(0, ratio)));
    },
    /** The page is hidden or left: the current look is reported, and timing starts afresh from the next `begin`. */
    leave() {
      finish(true);
      look = null;
    },
  };
}
