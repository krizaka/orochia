import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "CREATOR", "MEMBER"]);

export const videoVisibilityEnum = pgEnum("video_visibility", [
  "PUBLIC",
  "CONTACTS_ONLY",
  "APPROVED_FOLLOWERS_ONLY",
  "TIPPED_UNLOCKED",
  /** The accounts the creator invited, directly or through one of their audience lists. */
  "INVITED_ONLY",
  /** Put up for auction: listed with its auction, played only by its author and the winning bidder. */
  "AUCTION",
  /** Delivered for a challenge whose reward is its backers: played only by its author and the people who paid for it. */
  "CHALLENGE",
]);

export const videoStatusEnum = pgEnum("video_status", [
  "PENDING_UPLOAD",
  "PROCESSING",
  "READY",
  "FAILED",
]);

export const contactStatusEnum = pgEnum("contact_status", [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "BLOCKED",
]);

export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "TIP_RECEIVED",
  "PLATFORM_FEE",
  "CREATOR_CREDIT",
  "PAYOUT_REQUESTED",
  "PAYOUT_COMPLETED",
  "REFUND",
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "REQUESTED",
  "UNDER_REVIEW",
  "PROCESSING",
  "SETTLED",
  "FAILED",
]);

export const paymentGatewayEnum = pgEnum("payment_gateway", [
  "CCBILL",
  "SEGPAY",
  "CRYPTO",
  "STRIPE",
  /** Orochia credits: spent from the buyer's balance, settled in-house (no checkout, no webhook). */
  "CREDITS",
]);

export const paymentIntentStatusEnum = pgEnum("payment_intent_status", [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
]);

export const reportReasonEnum = pgEnum("report_reason", [
  "NON_CONSENSUAL",
  "UNDERAGE",
  "DMCA_COPYRIGHT",
  "TERMS_VIOLATION",
  "FRAUD_SCAM",
]);

export const reportStatusEnum = pgEnum("report_status", ["OPEN", "IN_REVIEW", "RESOLVED"]);

/**
 * Who may open a collection (playlist). A collection never grants playback: each of its videos is
 * still checked against its own visibility.
 */
export const collectionVisibilityEnum = pgEnum("collection_visibility", [
  "PUBLIC",
  "APPROVED_FOLLOWERS_ONLY",
  "CONTACTS_ONLY",
  "INVITED_ONLY",
  "PRIVATE",
]);

/** Where a video was shared to (counted, never used to grant access). */
export const shareChannelEnum = pgEnum("share_channel", ["LINK", "X", "WHATSAPP", "TELEGRAM", "EMAIL", "OTHER"]);

/** Sign-in providers an account can be linked to. */
export const authProviderEnum = pgEnum("auth_provider", ["GOOGLE", "FACEBOOK"]);

/** What a one-time account token is for. */
export const authTokenPurposeEnum = pgEnum("auth_token_purpose", ["VERIFY_EMAIL", "RESET_PASSWORD"]);

/** A follow of a creator: approved by the creator before it opens APPROVED_FOLLOWERS_ONLY videos. */
export const followStatusEnum = pgEnum("follow_status", ["PENDING", "APPROVED"]);

/** Movements of an account's Orochia credits (wallet_ledger). */
/**
 * Movements of an account's Orochia credits (wallet_ledger). HOLD reserves credits behind an auction bid (−) and
 * RELEASE gives them back (+) when the bid is outbid, declined or cancelled; a winning bid is released and SPENT.
 */
export const walletEntryTypeEnum = pgEnum("wallet_entry_type", ["TOPUP", "SPEND", "REFUND", "ADJUSTMENT", "HOLD", "RELEASE"]);

/**
 * An auction's life. OPEN covers "upcoming" and "open" (told apart by starts_at / ends_at); AWAITING_DECISION is the
 * creator's window to accept or decline the best bid; SOLD, DECLINED, UNSOLD (no bid) and CANCELLED are final.
 */
export const auctionStatusEnum = pgEnum("auction_status", ["OPEN", "AWAITING_DECISION", "SOLD", "DECLINED", "UNSOLD", "CANCELLED"]);

/** What the winning bidder receives: watching the video, or watching and downloading it. */
export const auctionRightsEnum = pgEnum("auction_rights", ["WATCH", "DOWNLOAD"]);

/** How an auction ends: the creator accepts or declines the best bid, or it sells to the highest bid, whatever it is. */
export const auctionSettlementEnum = pgEnum("auction_settlement", ["CREATOR_DECIDES", "HIGHEST_BID"]);

/** A bid: LEADING (its credits are held), OUTBID / RELEASED (credits given back), WON (credits paid). */
export const auctionBidStatusEnum = pgEnum("auction_bid_status", ["LEADING", "OUTBID", "WON", "RELEASED"]);

/**
 * Challenges (packages/payments/src/challenges.ts). GOAL — a creator's all-or-nothing goal: fans pledge, and the video
 * is made only if the goal is reached by the deadline. REQUEST — a fan dares one creator with an offer; the creator
 * accepts or declines. OPEN_CALL — a fan posts a challenge for any creator; creators apply and the author picks one.
 */
export const challengeKindEnum = pgEnum("challenge_kind", ["GOAL", "REQUEST", "OPEN_CALL"]);

/**
 * A challenge's life. OPEN takes pledges (and, for a request, waits for the creator; for an open call, takes
 * applications). ACCEPTED means a creator must deliver before `delivery_deadline` (a funded goal, an accepted request, an
 * assigned open call). DELIVERED is paid. DECLINED, EXPIRED (goal missed, no answer, nobody picked), FAILED (not
 * delivered in time) and CANCELLED release every pledge.
 */
export const challengeStatusEnum = pgEnum("challenge_status", ["OPEN", "ACCEPTED", "DELIVERED", "DECLINED", "EXPIRED", "FAILED", "CANCELLED"]);

/** What the creator delivers: a video (kept) or a story (24 hours). */
export const challengeDeliverableEnum = pgEnum("challenge_deliverable", ["VIDEO", "STORY"]);

/** Who watches the delivery: the people who paid for it, or everyone (a goal reached for the whole audience). */
export const challengeRewardEnum = pgEnum("challenge_reward", ["BACKERS", "EVERYONE"]);

/** A pledge: HELD (its credits are held), PAID (spent at delivery), RELEASED (given back). */
export const challengePledgeStatusEnum = pgEnum("challenge_pledge_status", ["HELD", "PAID", "RELEASED"]);

/** A creator's application to an open call. */
export const challengeApplicationStatusEnum = pgEnum("challenge_application_status", ["PENDING", "CHOSEN", "NOT_CHOSEN", "WITHDRAWN"]);
