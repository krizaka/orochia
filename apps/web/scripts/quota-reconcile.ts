/**
 * npm run quota:reconcile [-- --json]
 *
 * Reconciles the storage counters with Bunny (lib/storage-reconcile.ts): lists the Stream library, corrects every row's
 * bytes, zeroes the rows whose video Bunny no longer has, counts the orphans, records a snapshot, releases held uploads
 * that fit and re-checks the platform alerts. Reads the root .env; real environment variables win. Nothing is deleted.
 */
import fs from "node:fs";
import path from "node:path";

const rootEnv = path.resolve(__dirname, "..", "..", "..", ".env");
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const gb = (bytes: number | null | undefined) => (bytes == null ? "—" : `${(bytes / 1024 ** 3).toFixed(2)} GB`);

async function main(): Promise<number> {
  if (!process.env.MEDIA_STREAM_API_KEY?.trim()) {
    console.error("MEDIA_STREAM_API_KEY is not set: nothing to reconcile with.");
    return 1;
  }
  const { reconcileStorage } = await import("../lib/storage-reconcile");
  const { adminStorageOverview } = await import("../lib/storage-usage");
  const result = await reconcileStorage();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }
  const overview = await adminStorageOverview({ top: 10 });
  console.log(`Bunny library     ${result.libraryVideos} videos · ${gb(result.libraryBytes)} · ${Math.round(result.librarySeconds / 60)} min`);
  if (result.libraryTotals) console.log(`  account API     ${gb(result.libraryTotals.storageBytes)} (${result.libraryTotals.videoCount ?? "?"} videos)`);
  if (result.zone) console.log(`Storage zone      ${gb(result.zone.bytes)} · ${result.zone.files ?? "?"} files`);
  console.log(`Application       ${gb(result.appBytes)} counted · ${result.updatedRows} row(s) corrected · ${result.missingVideos} missing at Bunny`);
  console.log(`Orphans at Bunny  ${result.orphanVideos} video(s) · ${gb(result.orphanBytes)} (counted in the platform's usage)`);
  const p = overview.platform;
  console.log(`Platform          ${gb(p.used.bytes)} of ${gb(p.limit.bytes)}${p.percent !== null ? ` (${p.percent} %)` : ""}${overview.enabled ? "" : " — limits off"}`);
  if (result.released) console.log(`Released          ${result.released} held upload(s)`);
  if (result.alerts.length) console.log(`Alerts sent       ${result.alerts.join(" %, ")} %`);
  console.log("Largest accounts:");
  for (const c of overview.topCreators) console.log(`  @${c.username.padEnd(20)} ${gb(c.usedBytes).padStart(10)}  ${c.plan}${c.percent !== null ? ` ${c.percent} %` : ""}${c.held ? ` · ${c.held} held` : ""}`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
