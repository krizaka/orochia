#!/usr/bin/env node
// Uploads the default avatars and banners (made by generate-profile-media.mjs) to the product's storage zone under
// `public/defaults/avatars/<id>-{256,512}.webp` and `public/defaults/banners/<id>.webp`, then checks each one through the
// pull zone with the app's Referer. Credentials: the zone's storage key, zone name and pull-zone host from the env file
// given (MEDIA_STORAGE_API_KEY, MEDIA_STORAGE_ZONE, MEDIA_STORAGE_ENDPOINT, MEDIA_CDN_HOSTNAME) — never printed.
//
//   node scripts/dev-dataset/upload-defaults.mjs --from ~/.krizaka-worktrees/oro-profile-media --env-file <zone env file> [--referer https://dev.orochia.com/]
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const from = opt("from");
const envFile = opt("env-file");
const referer = opt("referer", "https://dev.orochia.com/");
if (!from || !envFile) {
  console.error("--from <folder> and --env-file <zone env file> are required");
  process.exit(2);
}
const env = Object.fromEntries(
  fs.readFileSync(envFile, "utf8").split("\n").map((l) => l.match(/^\s*([A-Z0-9_]+)\s*[=:]\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);
const zone = env.MEDIA_STORAGE_ZONE;
const host = env.MEDIA_CDN_HOSTNAME;
const endpoint = env.MEDIA_STORAGE_ENDPOINT || "storage.bunnycdn.com";
const key = env.MEDIA_STORAGE_API_KEY;
if (!zone || !host || !key) throw new Error("the env file lacks MEDIA_STORAGE_ZONE / MEDIA_CDN_HOSTNAME / MEDIA_STORAGE_API_KEY");

let failed = 0;
for (const kind of ["avatars", "banners"]) {
  for (const file of fs.readdirSync(path.join(from, kind)).filter((f) => f.endsWith(".webp"))) {
    const put = await fetch(`https://${endpoint}/${zone}/public/defaults/${kind}/${file}`, { method: "PUT", headers: { AccessKey: key, "content-type": "application/octet-stream" }, body: fs.readFileSync(path.join(from, kind, file)) });
    const get = put.ok ? await fetch(`https://${host}/public/defaults/${kind}/${file}`, { headers: { Referer: referer } }) : null;
    const ok = put.ok && get?.ok;
    if (!ok) failed++;
    console.log(`${ok ? "+" : "!"} ${kind}/${file} (upload ${put.status}, served ${get?.status ?? "-"})`);
  }
}
process.exit(failed ? 1 : 0);
