#!/usr/bin/env node
// The access policy of the Bunny Stream library's pull zone (docs/MEDIA_PIPELINE.md §5).
//   node scripts/media-zone-policy.mjs check --zone <pull-zone-id>          prints the drift, exits 1 if any
//   node scripts/media-zone-policy.mjs apply --zone <pull-zone-id>          fixes it (only the no-Referer switch)
// MEDIA_ACCOUNT_API_KEY (the Bunny account key) comes from the environment, never from an argument, never printed.
//
// Protection = CDN token authentication (every URL is signed server-side, with an expiry). The Referer list only keeps
// browsers on the app's domains; a native player (AVPlayer, ExoPlayer, expo-image) sends no Referer, so
// « block requests with no Referer » must be off — the signature, not the header, is what lets a request in.

/** What the zone must hold, as the list of what is wrong with `zone` (a Bunny pull zone). */
export function zoneDrift(zone) {
  const drift = [];
  if (zone.ZoneSecurityEnabled !== true) drift.push("ZoneSecurityEnabled must be true (signed URLs are the protection)");
  if (zone.BlockNoneReferrer !== false) drift.push("BlockNoneReferrer must be false (native apps send no Referer)");
  if (!Array.isArray(zone.AllowedReferrers) || zone.AllowedReferrers.length === 0) drift.push("AllowedReferrers must keep the app's domains");
  return drift;
}

/**
 * The settings to post to fix the zone, or null when it must not be touched: a zone without token authentication is
 * open, and opening it further is never the fix.
 */
export function applyPolicy(zone) {
  if (zone.ZoneSecurityEnabled !== true) return null;
  return zone.BlockNoneReferrer === false ? {} : { BlockNoneReferrer: false };
}

async function main() {
  const [command, flag, zoneId] = process.argv.slice(2);
  const key = process.env.MEDIA_ACCOUNT_API_KEY;
  if (!["check", "apply"].includes(command) || flag !== "--zone" || !zoneId || !key) {
    console.error("usage: MEDIA_ACCOUNT_API_KEY=… node scripts/media-zone-policy.mjs <check|apply> --zone <pull-zone-id>");
    process.exit(2);
  }
  const url = `https://api.bunny.net/pullzone/${encodeURIComponent(zoneId)}`;
  const headers = { AccessKey: key, "Content-Type": "application/json", Accept: "application/json" };
  const read = async () => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Bunny answered ${res.status}`);
    return res.json();
  };

  const zone = await read();
  const drift = zoneDrift(zone);
  if (command === "check" || drift.length === 0) {
    console.log(drift.length === 0 ? "pull zone policy OK" : drift.join("\n"));
    process.exit(drift.length === 0 ? 0 : 1);
  }
  const patch = applyPolicy(zone);
  if (patch === null) throw new Error("the zone has token authentication off: enable it by hand, this script never opens a zone");
  if (Object.keys(patch).length > 0) {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(patch) });
    if (!res.ok) throw new Error(`Bunny refused the change (${res.status})`);
  }
  const after = zoneDrift(await read());
  console.log(after.length === 0 ? "pull zone policy applied" : after.join("\n"));
  process.exit(after.length === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
