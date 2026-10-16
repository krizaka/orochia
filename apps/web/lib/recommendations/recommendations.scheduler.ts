import { addSeconds, isAfter, secondsToMilliseconds } from "date-fns";

import { pseudonymKey } from "../env";
import { orazakaConfigured } from "../orazaka";
import { syncCatalogue } from "./recommendations.catalogue";
import { drainOutbox } from "./recommendations.outbox";
import { recommendationSettings } from "./recommendations.settings";

/**
 * The two background loops of the recommender (started by instrumentation.ts on every instance): the outbox is drained
 * every `outboxIntervalSeconds`, the catalogue reconciled every `catalogueIntervalSeconds` (both read from the settings
 * at each tick, so a published version changes the pace without a restart). Instances share the outbox with
 * `FOR UPDATE SKIP LOCKED`; two catalogue rounds write the same rows (upserts). Nothing runs without Orazaka or the
 * pseudonym key; a failed round is the next round's work.
 */
// @fixed: the tick of the loop; the real periods are settings checked at each tick
const TICK_SECONDS = 5;
const holder = globalThis as unknown as { __orochiaRecoScheduler?: NodeJS.Timeout };

export function startRecommendationsScheduler() {
  if (holder.__orochiaRecoScheduler || !orazakaConfigured() || !pseudonymKey()) return;
  let busy = false;
  let lastOutbox: Date | null = null;
  let lastCatalogue: Date | null = null;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const now = new Date();
      const settings = await recommendationSettings(now);
      if (!settings) return;
      if (!lastOutbox || !isAfter(addSeconds(lastOutbox, settings.outboxIntervalSeconds), now)) {
        lastOutbox = now;
        const s = await drainOutbox(now, settings);
        if (s.sent || s.erased || s.failed) console.log(`[recommendations] outbox sent=${s.sent} erased=${s.erased} failed=${s.failed}${s.requestCode ? ` code=${s.requestCode}` : ""}`);
      }
      if (!lastCatalogue || !isAfter(addSeconds(lastCatalogue, settings.catalogueIntervalSeconds), now)) {
        lastCatalogue = now;
        const c = await syncCatalogue(now, settings);
        if (c.upserted || c.erased) console.log(`[recommendations] catalogue upserted=${c.upserted} erased=${c.erased} embeddingRun=${c.runId ?? "-"}`);
      }
    } catch (error) {
      console.error("[recommendations] round failed", error);
    } finally {
      busy = false;
    }
  };
  holder.__orochiaRecoScheduler = setInterval(() => void tick(), secondsToMilliseconds(TICK_SECONDS));
  holder.__orochiaRecoScheduler.unref?.();
}
