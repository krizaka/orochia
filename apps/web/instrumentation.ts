/** Server start-up: background loops that every instance runs (Node runtime only, never during the build). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { startAuctionScheduler } = await import("./lib/auction-scheduler");
  startAuctionScheduler();
}
