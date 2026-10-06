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
