import { embedPending } from "./explorer-index";
import { orazakaConfigured } from "./orazaka";

/**
 * Keeps the Explorer's vectors up to date, run by every instance (started by instrumentation.ts) every 10 minutes and a
 * minute after start: the discoverable videos with no vector yet, or edited since, are embedded by Orazaka (64 at most
 * per round; an unchanged video is skipped by its hash). Nothing runs when Orazaka is not configured, and a round that
 * fails is simply the next round's work — search never waits for it. Two instances embedding the same video write the
 * same row (upsert), so there is no lock to take.
 */
const INTERVAL_MS = 10 * 60_000;
const holder = globalThis as unknown as { __orochiaExplorerScheduler?: NodeJS.Timeout };

export function startExplorerScheduler() {
  if (holder.__orochiaExplorerScheduler || !orazakaConfigured()) return;
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    embedPending({ limit: 64 })
      .catch((error: unknown) => console.error("[explorer] indexing round failed", error))
      .finally(() => {
        running = false;
      });
  };
  setTimeout(run, 60_000 + Math.floor(Math.random() * 30_000)).unref?.();
  holder.__orochiaExplorerScheduler = setInterval(run, INTERVAL_MS);
  holder.__orochiaExplorerScheduler.unref?.();
}
