/**
 * The rules of an Orochia auction, as pure functions (no database, no clock of their own) so the server, the UI and
 * the tests apply the very same ones. Amounts are cents (1 credit = 1 US cent).
 */

/** Lowest starting price and highest bid accepted. */
export const AUCTION_MIN_STARTING_PRICE_CENTS = 100;
export const AUCTION_MAX_BID_CENTS = 1_000_000_00;

/** An auction runs between one hour and fourteen days, and starts within thirty days. */
export const AUCTION_MIN_DURATION_MS = 60 * 60 * 1000;
export const AUCTION_MAX_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
export const AUCTION_MAX_START_DELAY_MS = 30 * 24 * 60 * 60 * 1000;

/** A bid placed less than two minutes before the end pushes the end two minutes after the bid (anti-sniping). */
export const AUCTION_SOFT_CLOSE_MS = 2 * 60 * 1000;

/** When the creator decides, they have 48 hours; past that the best bid is declined and its credits released. */
export const AUCTION_DECISION_WINDOW_MS = 48 * 60 * 60 * 1000;

/** The step between two bids grows with the price, like a saleroom's ladder. */
export function bidIncrementCents(currentCents: number): number {
  if (currentCents < 10_00) return 50;
  if (currentCents < 50_00) return 1_00;
  if (currentCents < 200_00) return 5_00;
  if (currentCents < 1_000_00) return 10_00;
  return 25_00;
}

/** The lowest acceptable next bid: the starting price for the first one, then the best bid plus one step. */
export function minimumNextBidCents(auction: { startingPriceCents: number; highestBidCents: number; bidsCount: number }): number {
  if (auction.bidsCount === 0) return auction.startingPriceCents;
  return auction.highestBidCents + bidIncrementCents(auction.highestBidCents);
}

/** One-tap amounts offered to a bidder: the minimum, then one and three steps above it. */
export function suggestedBidsCents(minimumCents: number): number[] {
  const step = bidIncrementCents(minimumCents);
  return [minimumCents, minimumCents + step, minimumCents + 3 * step];
}

/** Where an auction stands for a viewer, derived from its stored status and the clock. */
export type AuctionPhase = "UPCOMING" | "OPEN" | "ENDING" | "AWAITING_DECISION" | "SOLD" | "DECLINED" | "UNSOLD" | "CANCELLED";

export function auctionPhase(auction: { status: string; startsAt: Date; endsAt: Date }, now: Date): AuctionPhase {
  if (auction.status !== "OPEN") return auction.status as AuctionPhase;
  if (now < auction.startsAt) return "UPCOMING";
  // Past its end, an open auction is being closed (by the scheduler or the next read).
  if (now >= auction.endsAt) return "ENDING";
  return "OPEN";
}

/** The end after a bid placed at `now`: unchanged, or pushed back when the bid lands in the soft-close window. */
export function endAfterBid(endsAt: Date, now: Date): { endsAt: Date; extended: boolean } {
  if (endsAt.getTime() - now.getTime() >= AUCTION_SOFT_CLOSE_MS) return { endsAt, extended: false };
  return { endsAt: new Date(now.getTime() + AUCTION_SOFT_CLOSE_MS), extended: true };
}

export type ScheduleProblem = "START_IN_PAST" | "START_TOO_FAR" | "TOO_SHORT" | "TOO_LONG";

/**
 * Checks the window a creator chose. A start up to five minutes in the past means "now" (the form was filled a moment
 * ago); the returned start is never before `now`.
 */
export function checkAuctionSchedule(startsAt: Date, endsAt: Date, now: Date): { ok: true; startsAt: Date } | { ok: false; problem: ScheduleProblem } {
  if (startsAt.getTime() < now.getTime() - 5 * 60 * 1000) return { ok: false, problem: "START_IN_PAST" };
  const start = startsAt < now ? now : startsAt;
  if (start.getTime() - now.getTime() > AUCTION_MAX_START_DELAY_MS) return { ok: false, problem: "START_TOO_FAR" };
  const duration = endsAt.getTime() - start.getTime();
  if (duration < AUCTION_MIN_DURATION_MS - 60 * 1000) return { ok: false, problem: "TOO_SHORT" };
  if (duration > AUCTION_MAX_DURATION_MS) return { ok: false, problem: "TOO_LONG" };
  return { ok: true, startsAt: start };
}
