import { closeAuction, dueAuctionIds } from "@orochia/payments";
import { announceClose } from "./auctions";

/**
 * Closes auctions on time. Every app instance runs this loop (started by instrumentation.ts): it picks the auctions
 * past their end or their decision deadline and closes each one with SKIP LOCKED, so instances share the queue and an
 * auction is never closed twice. Reading an auction past its end closes it too (lib/auctions.ts), so a stopped loop
 * delays a notification, never a result.
 */

const INTERVAL_MS = 5_000;
const holder = globalThis as unknown as { __orochiaAuctionScheduler?: NodeJS.Timeout };

async function tick() {
  const now = new Date();
  for (const id of await dueAuctionIds(now)) {
    const outcome = await closeAuction(id, now, { skipLocked: true });
    await announceClose(outcome);
  }
}

export function startAuctionScheduler() {
  if (holder.__orochiaAuctionScheduler) return;
  let running = false;
  holder.__orochiaAuctionScheduler = setInterval(() => {
    if (running) return;
    running = true;
    tick()
      .catch((error: unknown) => console.error("[auctions] closing failed", error))
      .finally(() => {
        running = false;
      });
  }, INTERVAL_MS);
  holder.__orochiaAuctionScheduler.unref?.();
}
