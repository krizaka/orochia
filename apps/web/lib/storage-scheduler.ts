import { sweepRateLimits } from "./rate-limit";
import { reconcileIsDue, reconcileStorage } from "./storage-reconcile";
import { checkPlatformAlerts } from "./storage-usage";

/**
 * Background housekeeping of the quotas and limits, run by every instance (started by instrumentation.ts) every
 * 10 minutes: expired rate-limit windows are swept (postgres store), the platform alerts re-checked, and the storage
 * reconciled with Bunny when the last reconciliation is older than QUOTA_RECONCILE_INTERVAL_MINUTES (360; 0 = never).
 * The interval check reads the last snapshot, so instances do not all reconcile; if two do, the result is the same.
 */
const INTERVAL_MS = 10 * 60_000;
const holder = globalThis as unknown as { __orochiaStorageScheduler?: NodeJS.Timeout };

async function tick() {
  await sweepRateLimits().catch((error: unknown) => console.error("[limits] sweep failed", error));
  await checkPlatformAlerts();
  if (await reconcileIsDue()) await reconcileStorage();
}

export function startStorageScheduler() {
  if (holder.__orochiaStorageScheduler) return;
  let running = false;
  const run = () => {
    if (running) return;
    running = true;
    tick()
      .catch((error: unknown) => console.error("[quota] housekeeping failed", error))
      .finally(() => {
        running = false;
      });
  };
  // A minute after start (with jitter, so a fleet restarting together does not hit Bunny at once), then every 10 minutes.
  setTimeout(run, 60_000 + Math.floor(Math.random() * 30_000)).unref?.();
  holder.__orochiaStorageScheduler = setInterval(run, INTERVAL_MS);
  holder.__orochiaStorageScheduler.unref?.();
}
