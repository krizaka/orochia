import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "CREATOR", "MEMBER"]);

export const videoVisibilityEnum = pgEnum("video_visibility", [
  "PUBLIC",
  "CONTACTS_ONLY",
  "APPROVED_FOLLOWERS_ONLY",
  "TIPPED_UNLOCKED",
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

/** A follow of a creator: approved by the creator before it opens APPROVED_FOLLOWERS_ONLY videos. */
export const followStatusEnum = pgEnum("follow_status", ["PENDING", "APPROVED"]);
