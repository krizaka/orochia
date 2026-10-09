import { describe, expect, it } from "vitest";

import { auctionCountdown, auctionPrice } from "./auction-presenter";
import type { AuctionCard } from "./types";

const base: AuctionCard = {
  id: "a1",
  phase: "OPEN",
  rights: "WATCH",
  settlement: "HIGHEST_BID",
  highestBidCents: 4200,
  startingPriceCents: 1500,
  bidsCount: 3,
  startsAt: "2026-10-09T10:00:00.000Z",
  endsAt: "2026-10-10T10:00:00.000Z",
  videoId: "v1",
  title: "A clip",
  thumbnailUrl: null,
  creatorUsername: "maker",
  creatorName: "Maker",
  creatorAvatar: null,
};

describe("auctionPrice", () => {
  it("shows the starting price while nobody has bid", () => {
    expect(auctionPrice({ ...base, bidsCount: 0, highestBidCents: 0 })).toEqual({ cents: 1500, labelKey: "auction.startingPrice" });
  });

  it("shows the current bid once there are bids", () => {
    expect(auctionPrice(base)).toEqual({ cents: 4200, labelKey: "auction.currentBid" });
  });

  it("shows the sale price of a sold auction", () => {
    expect(auctionPrice({ ...base, phase: "SOLD" })).toEqual({ cents: 4200, labelKey: "auction.soldFor" });
  });
});

describe("auctionCountdown", () => {
  it("counts down to the end of an open auction", () => {
    expect(auctionCountdown(base)).toEqual({ target: base.endsAt, labelKey: "auction.endsIn" });
  });

  it("counts down to the start of an upcoming auction", () => {
    expect(auctionCountdown({ ...base, phase: "UPCOMING" })).toEqual({ target: base.startsAt, labelKey: "auction.startsIn" });
  });

  it("has no countdown while ending, awaiting a decision or closed", () => {
    for (const phase of ["ENDING", "AWAITING_DECISION", "SOLD", "DECLINED", "UNSOLD", "CANCELLED"] as const) {
      expect(auctionCountdown({ ...base, phase })).toBeNull();
    }
  });
});
