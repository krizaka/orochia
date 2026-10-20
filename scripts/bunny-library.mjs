#!/usr/bin/env node
// The Bunny Stream library's player and watermark settings, as code (orochia: « designed player, our watermark »).
//   node scripts/bunny-library.mjs check                       prints the drift between the library and this file, exits 1 if any
//   node scripts/bunny-library.mjs apply                       applies the player look (colours, controls, captions): idempotent
//   node scripts/bunny-library.mjs apply --watermark on        …and burns the Orochia mark into NEW encodes
//   node scripts/bunny-library.mjs apply --watermark off       …or removes it (new encodes only; see docs/MEDIA_PIPELINE.md §7)
//   add --dry-run to print the payload without sending anything; --library <id> (default MEDIA_STREAM_LIBRARY_ID).
// MEDIA_ACCOUNT_API_KEY (the Bunny account key) comes from the environment, never from an argument, never printed.
//
// Our own player (apps/web/components/VideoPlayer.tsx) is the face; this is the look of Bunny's embed player, wherever
// it is used (the dashboard preview, shared embeds), and the burned-in watermark that copies leaving the site keep.

/** The Orochia brand accent (`--kz-accent` of @krizaka/tokens/brands/orochia.css, hsl(262.1 83.3% 57.8%)). */
export const BRAND_ACCENT = "#7c3aed";
/** The watermark: the Orochia mark on transparent (brand/manifest.json, generated from @krizaka/ui). */
export const WATERMARK_IMAGE_URL = "https://krizaka-assets.b-cdn.net/brand/orochia/mark-dark-512.png";

/** The player's look. Controls keep Bunny's full set minus AirPlay noise on desktop; every key is a Stream library field. */
export const PLAYER_SETTINGS = Object.freeze({
  PlayerKeyColor: BRAND_ACCENT,
  Controls: "play-large,play,progress,current-time,mute,volume,captions,settings,pip,fullscreen",
  FontFamily: "Inter",
  EnableCompactControls: true,
});

/**
 * The watermark's box, in percent of the picture. Bunny has ONE box per library and reads width and height as a share of
 * each axis, so the mark's shape depends on the clip's: a square box (10 × 10 %) is an oval 1.78 : 1 on 9:16 and 16:9
 * alike — the same, mild, distortion for both orientations — where a box made square for 9:16 alone was 3 : 1 on 16:9.
 * Bottom-right, ~3 % from the edges.
 */
export const WATERMARK_BOX = Object.freeze({ WatermarkPositionLeft: 87, WatermarkPositionTop: 87, WatermarkWidth: 10, WatermarkHeight: 10 });

/** The fields of `desired` that `library` does not hold yet (an idempotent PATCH: empty once applied). */
export function libraryPatch(library, desired) {
  const patch = {};
  for (const [key, value] of Object.entries(desired)) {
    if (library[key] !== value) patch[key] = value;
  }
  return patch;
}

/** What `apply` must do for `watermark` ("keep" | "on" | "off"): the library patch and whether to upload / delete the image. */
export function plan(library, watermark = "keep") {
  const desired = { ...PLAYER_SETTINGS };
  if (watermark === "on") Object.assign(desired, WATERMARK_BOX);
  const patch = libraryPatch(library, desired);
  return {
    patch,
    uploadWatermark: watermark === "on" && library.HasWatermark !== true,
    deleteWatermark: watermark === "off" && library.HasWatermark === true,
  };
}

/** The drift as sentences (for `check`). The watermark is reported, never counted: it is a choice, not a default. */
export function drift(library) {
  return Object.entries(libraryPatch(library, PLAYER_SETTINGS)).map(([k, v]) => `${k}: ${JSON.stringify(library[k])} → ${JSON.stringify(v)}`);
}

const API = "https://api.bunny.net";

export function bunnyLibraryApi(libraryId, accountKey, fetchImpl = fetch) {
  const base = `${API}/videolibrary/${encodeURIComponent(libraryId)}`;
  const headers = { AccessKey: accountKey, Accept: "application/json" };
  const call = async (path, init) => {
    const res = await fetchImpl(`${base}${path}`, { ...init, headers: { ...headers, ...init?.headers }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Bunny ${init?.method ?? "GET"} /videolibrary/${libraryId}${path} answered ${res.status}`);
    return res;
  };
  return {
    get: async () => (await call("", {})).json(),
    update: (patch) => call("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }),
    uploadWatermark: (png) => call("/watermark", { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: png }),
    deleteWatermark: () => call("/watermark", { method: "DELETE" }),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
  const watermark = flag("--watermark") ?? "keep";
  const libraryId = flag("--library") ?? process.env.MEDIA_STREAM_LIBRARY_ID;
  const key = process.env.MEDIA_ACCOUNT_API_KEY;
  if (!["check", "apply"].includes(command) || !["keep", "on", "off"].includes(watermark) || !libraryId || !key) {
    console.error("usage: MEDIA_ACCOUNT_API_KEY=… MEDIA_STREAM_LIBRARY_ID=… node scripts/bunny-library.mjs <check|apply> [--watermark on|off] [--dry-run] [--library <id>]");
    process.exit(2);
  }
  const api = bunnyLibraryApi(libraryId, key);
  const library = await api.get();
  if (command === "check") {
    const lines = drift(library);
    console.log(lines.length ? `Drift on library ${libraryId} (${library.Name}):\n- ${lines.join("\n- ")}` : `Library ${libraryId} (${library.Name}) holds the player settings.`);
    console.log(`Watermark: ${library.HasWatermark ? "on" : "off"} (new encodes only).`);
    process.exit(lines.length ? 1 : 0);
  }
  const todo = plan(library, watermark);
  console.log(JSON.stringify({ library: libraryId, ...todo }, null, 2));
  if (args.includes("--dry-run")) return;
  if (todo.uploadWatermark) {
    const png = Buffer.from(await (await fetch(WATERMARK_IMAGE_URL)).arrayBuffer());
    await api.uploadWatermark(png);
  }
  if (Object.keys(todo.patch).length) await api.update(todo.patch);
  if (todo.deleteWatermark) await api.deleteWatermark();
  console.log("applied.");
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
