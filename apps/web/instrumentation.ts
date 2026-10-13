/** Server start-up: the environment check, then the background loops that every instance runs (Node runtime only, never during the build). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  // A deployment with an incomplete or malformed environment refuses to start (lib/env.ts, ENV_VARS).
  const { assertEnv } = await import("./lib/env");
  assertEnv();
  const { startAuctionScheduler } = await import("./lib/auction-scheduler");
  startAuctionScheduler();
  const { startStorageScheduler } = await import("./lib/storage-scheduler");
  startStorageScheduler();
}
