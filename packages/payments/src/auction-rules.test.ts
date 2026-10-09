import { describe, expect, it } from "vitest";
import {
  AUCTION_SOFT_CLOSE_MS,
  auctionPhase,
  bidIncrementCents,
  checkAuctionSchedule,
  endAfterBid,
  minimumNextBidCents,
  suggestedBidsCents,
} from "./auction-rules";

const at = (iso: string) => new Date(iso);

describe("auction rules", () => {
  it("climbs the bid ladder with the price", () => {
    expect(bidIncrementCents(0)).toBe(50);
    expect(bidIncrementCents(9_99)).toBe(50);
    expect(bidIncrementCents(10_00)).toBe(1_00);
    expect(bidIncrementCents(60_00)).toBe(5_00);
    expect(bidIncrementCents(500_00)).toBe(10_00);
    expect(bidIncrementCents(5_000_00)).toBe(25_00);
  });

  it("asks the starting price first, then the best bid plus one step", () => {
    expect(minimumNextBidCents({ startingPriceCents: 20_00, highestBidCents: 0, bidsCount: 0 })).toBe(20_00);
    expect(minimumNextBidCents({ startingPriceCents: 20_00, highestBidCents: 20_00, bidsCount: 1 })).toBe(21_00);
    expect(suggestedBidsCents(21_00)).toEqual([21_00, 22_00, 24_00]);
  });

  it("tells upcoming, live and ending apart, and keeps final states", () => {
    const auction = { status: "OPEN", startsAt: at("2026-01-01T10:00:00Z"), endsAt: at("2026-01-01T12:00:00Z") };
    expect(auctionPhase(auction, at("2026-01-01T09:00:00Z"))).toBe("UPCOMING");
    expect(auctionPhase(auction, at("2026-01-01T11:00:00Z"))).toBe("OPEN");
    expect(auctionPhase(auction, at("2026-01-01T12:00:00Z"))).toBe("ENDING");
    expect(auctionPhase({ ...auction, status: "SOLD" }, at("2026-01-01T11:00:00Z"))).toBe("SOLD");
  });

  it("pushes the end back only for a bid in the last two minutes", () => {
    const end = at("2026-01-01T12:00:00Z");
    expect(endAfterBid(end, at("2026-01-01T11:50:00Z"))).toEqual({ endsAt: end, extended: false });
    const late = at("2026-01-01T11:59:30Z");
    expect(endAfterBid(end, late)).toEqual({ endsAt: new Date(late.getTime() + AUCTION_SOFT_CLOSE_MS), extended: true });
  });

  it("checks the schedule a creator chose", () => {
    const now = at("2026-01-01T10:00:00Z");
    expect(checkAuctionSchedule(at("2026-01-01T09:58:00Z"), at("2026-01-02T10:00:00Z"), now)).toEqual({ ok: true, startsAt: now });
    expect(checkAuctionSchedule(at("2026-01-01T09:00:00Z"), at("2026-01-02T10:00:00Z"), now)).toEqual({ ok: false, problem: "START_IN_PAST" });
    expect(checkAuctionSchedule(now, at("2026-01-01T10:30:00Z"), now)).toEqual({ ok: false, problem: "TOO_SHORT" });
    expect(checkAuctionSchedule(now, at("2026-01-20T10:00:00Z"), now)).toEqual({ ok: false, problem: "TOO_LONG" });
    expect(checkAuctionSchedule(at("2026-03-01T10:00:00Z"), at("2026-03-02T10:00:00Z"), now)).toEqual({ ok: false, problem: "START_TOO_FAR" });
  });
});
