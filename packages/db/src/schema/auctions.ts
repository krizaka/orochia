import { pgTable, text, timestamp, uuid, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { videos } from "./videos";
import { auctionBidStatusEnum, auctionRightsEnum, auctionSettlementEnum, auctionStatusEnum, videoVisibilityEnum } from "./enums";

/**
 * A video put up for auction by its creator, between `starts_at` and `ends_at`. Bids are paid in Orochia credits and
 * held (wallet_ledger HOLD) while they lead, so the winner has always paid. A bid in the last minutes pushes `ends_at`
 * back (anti-sniping); `scheduled_ends_at` keeps the end the creator chose. While an auction is open, awaiting its
 * decision or sold, the video's visibility is AUCTION; when it ends without a sale, `previous_visibility` comes back.
 * The state machine lives in packages/payments/src/auctions.ts, never in a route.
 */
export const auctions = pgTable(
  "auctions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    videoId: uuid("video_id")
      .references(() => videos.id, { onDelete: "cascade" })
      .notNull(),
    creatorId: uuid("creator_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    status: auctionStatusEnum("status").default("OPEN").notNull(),
    rights: auctionRightsEnum("rights").default("WATCH").notNull(),
    settlement: auctionSettlementEnum("settlement").default("CREATOR_DECIDES").notNull(),
    startingPriceCents: integer("starting_price_cents").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    scheduledEndsAt: timestamp("scheduled_ends_at", { withTimezone: true }).notNull(),
    /** Set when the auction ends with bids and the creator decides: past it, the best bid is declined. */
    decisionDeadline: timestamp("decision_deadline", { withTimezone: true }),
    /** Kept in step with auction_bids under the auction's row lock. */
    highestBidCents: integer("highest_bid_cents").default(0).notNull(),
    bidsCount: integer("bids_count").default(0).notNull(),
    leadingBidId: uuid("leading_bid_id"),
    leaderId: uuid("leader_id").references(() => users.id, { onDelete: "set null" }),
    previousVisibility: videoVisibilityEnum("previous_visibility").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // A video has one auction at a time, and a sold one is never auctioned again (the winner's access is exclusive).
    onePerVideoIdx: uniqueIndex("auctions_one_active_per_video_idx")
      .on(table.videoId)
      .where(sql`status in ('OPEN', 'AWAITING_DECISION', 'SOLD')`),
    // The closer's two queues: open auctions past their end, decisions past their deadline.
    dueIdx: index("auctions_status_ends_idx").on(table.status, table.endsAt),
    decisionIdx: index("auctions_decision_deadline_idx").on(table.decisionDeadline).where(sql`status = 'AWAITING_DECISION'`),
    creatorIdx: index("auctions_creator_idx").on(table.creatorId, table.createdAt),
  })
);

/** Every bid ever placed, append-only but for its status. A bid's held credits are referenced `hold_<bid id>`. */
export const auctionBids = pgTable(
  "auction_bids",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    auctionId: uuid("auction_id")
      .references(() => auctions.id, { onDelete: "cascade" })
      .notNull(),
    bidderId: uuid("bidder_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: auctionBidStatusEnum("status").default("LEADING").notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    auctionIdx: index("auction_bids_auction_idx").on(table.auctionId, table.createdAt),
    bidderIdx: index("auction_bids_bidder_idx").on(table.bidderId, table.createdAt),
    // At most one bid holds credits per auction.
    oneLeaderIdx: uniqueIndex("auction_bids_one_leader_idx").on(table.auctionId).where(sql`status = 'LEADING'`),
  })
);
