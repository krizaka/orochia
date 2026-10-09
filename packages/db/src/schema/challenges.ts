import { pgTable, text, timestamp, uuid, varchar, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { videos } from "./videos";
import { stories } from "./stories";
import {
  challengeApplicationStatusEnum,
  challengeDeliverableEnum,
  challengeKindEnum,
  challengePledgeStatusEnum,
  challengeRewardEnum,
  challengeStatusEnum,
  videoVisibilityEnum,
} from "./enums";

/**
 * A challenge: something a creator makes once enough people pay for it. Money is pledged in Orochia credits and held
 * (wallet_ledger HOLD) until the creator delivers — then spent and credited to the creator — or given back when the
 * challenge does not happen. `author_id` wrote it; `creator_id` makes it (the author of a goal, the creator dared by a
 * request, the applicant chosen for an open call — null until then). The state machine lives in
 * packages/payments/src/challenges.ts, never in a route.
 */
export const challenges = pgTable(
  "challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: challengeKindEnum("kind").notNull(),
    status: challengeStatusEnum("status").default("OPEN").notNull(),
    authorId: uuid("author_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    creatorId: uuid("creator_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description").notNull(),
    deliverable: challengeDeliverableEnum("deliverable").default("VIDEO").notNull(),
    reward: challengeRewardEnum("reward").default("BACKERS").notNull(),
    /** A goal's target; a request's and an open call's pot is what was pledged. */
    goalCents: integer("goal_cents"),
    /** Kept in step with challenge_pledges (HELD + PAID) under the challenge's row lock. */
    pledgedCents: integer("pledged_cents").default(0).notNull(),
    backersCount: integer("backers_count").default(0).notNull(),
    /** Until when it takes pledges (goal), waits for an answer (request) or for a pick (open call). */
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),
    /** Days the creator has to deliver once committed. */
    deliveryDays: integer("delivery_days").notNull(),
    deliveryDeadline: timestamp("delivery_deadline", { withTimezone: true }),
    deliveredVideoId: uuid("delivered_video_id").references(() => videos.id, {
      onDelete: "set null",
    }),
    deliveredStoryId: uuid("delivered_story_id").references(() => stories.id, {
      onDelete: "set null",
    }),
    /** The delivered video's audience before the challenge, should an operator need to give it back. */
    previousVisibility: videoVisibilityEnum("previous_visibility"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // The closer's two queues: open challenges past their deadline, accepted ones past their delivery deadline.
    dueIdx: index("challenges_status_deadline_idx").on(table.status, table.deadline),
    deliveryIdx: index("challenges_delivery_deadline_idx")
      .on(table.deliveryDeadline)
      .where(sql`status = 'ACCEPTED'`),
    authorIdx: index("challenges_author_idx").on(table.authorId, table.createdAt),
    creatorIdx: index("challenges_creator_idx").on(table.creatorId, table.createdAt),
    // A video or a story pays for one challenge.
    oneVideoIdx: uniqueIndex("challenges_delivered_video_idx")
      .on(table.deliveredVideoId)
      .where(sql`delivered_video_id is not null`),
    oneStoryIdx: uniqueIndex("challenges_delivered_story_idx")
      .on(table.deliveredStoryId)
      .where(sql`delivered_story_id is not null`),
  }),
);

/** Every pledge, append-only but for its status. References: `hold_cpl_<id>`, `release_cpl_<id>`, `spend_cpl_<id>`. */
export const challengePledges = pgTable(
  "challenge_pledges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    challengeId: uuid("challenge_id")
      .references(() => challenges.id, { onDelete: "cascade" })
      .notNull(),
    backerId: uuid("backer_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: challengePledgeStatusEnum("status").default("HELD").notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    challengeIdx: index("challenge_pledges_challenge_idx").on(table.challengeId, table.createdAt),
    backerIdx: index("challenge_pledges_backer_idx").on(table.backerId, table.createdAt),
  }),
);

/** Creators who want to take an open call; its author picks one. */
export const challengeApplications = pgTable(
  "challenge_applications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    challengeId: uuid("challenge_id")
      .references(() => challenges.id, { onDelete: "cascade" })
      .notNull(),
    creatorId: uuid("creator_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    note: varchar("note", { length: 280 }),
    status: challengeApplicationStatusEnum("status").default("PENDING").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    oncePerCreator: uniqueIndex("challenge_applications_once_idx").on(table.challengeId, table.creatorId),
  }),
);
