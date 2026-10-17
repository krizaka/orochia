import { closeAuction, closeChallenge, dueAuctionIds, dueChallengeIds } from "@orochia/payments";
import { announceClose } from "./auctions";
import { announceClose as announceChallengeClose } from "./challenges";

/**
 * Closes auctions and challenges on time. Every app instance runs this loop (started by instrumentation.ts): it picks the auctions
 * past their end or their decision deadline and closes each one with SKIP LOCKED, so instances share the queue and an
 * auction (or challenge) is never closed twice. Reading one past its end closes it too (lib/auctions.ts, lib/challenges.ts), so a stopped loop
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
  for (const id of await dueChallengeIds(now)) {
    await announceChallengeClose(await closeChallenge(id, now, { skipLocked: true }));
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
