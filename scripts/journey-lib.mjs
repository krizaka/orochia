// The pure parts of scripts/journey-dev.mjs (the core journey on the real dev backend): what a step proves, the request
// ids it keeps and the arithmetic of what a tip pays. No network here, so tests/journey.test can run it.

/** A request id the platform edge gives every response (`cf-ray`), the only id that identifies one call from outside. */
export function requestIdOf(headers) {
  const get = (name) => (typeof headers?.get === "function" ? headers.get(name) : headers?.[name]);
  return get("cf-ray") ?? get("x-request-id") ?? null;
}

/** The creator's net share of a tip, in cents, for the platform fee (a percentage), rounded down: the ledger writes the fee, the creator keeps the rest. */
export function creatorShareCents(amountCents, feePercent) {
  const fee = Math.round((amountCents * feePercent) / 100);
  return amountCents - fee;
}

/** One step of the journey: what was asked, what answered, and the ids to find it again. */
export function step(name, { ok, status, ids = {}, note = "" }) {
  return { name, ok: Boolean(ok), status: status ?? null, ids, note };
}

/** The journey is proven when every step is and the five moments of the core journey are all there. */
export const MOMENTS = ["upload", "encode", "watch", "tip", "earnings"];

export function verdict(steps) {
  const missing = MOMENTS.filter((m) => !steps.some((s) => s.name === m));
  const failed = steps.filter((s) => !s.ok).map((s) => s.name);
  return { proven: missing.length === 0 && failed.length === 0, missing, failed };
}

/** A master playlist that really lists renditions: the first line is #EXTM3U and a stream or a segment follows. */
export function isHlsPlaylist(text) {
  return typeof text === "string" && text.startsWith("#EXTM3U") && /#EXT-X-STREAM-INF|#EXTINF/.test(text);
}

/** The synthetic clip's title: honest about what it is, dated, so a leftover is recognised and removed. */
export function clipTitle(now) {
  return `Journey check ${now.toISOString().slice(0, 16).replace("T", " ")}Z (synthetic test clip)`;
}
