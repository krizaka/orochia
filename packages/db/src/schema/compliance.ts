import { pgTable, text, timestamp, uuid, varchar, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { videos } from "./videos";
import { reportReasonEnum, reportStatusEnum } from "./enums";

/**
 * Content reports (non-consensual content, suspected minors, DMCA, fraud…). Every report is
 * persisted before it is acknowledged: a report that only reaches a log line is a report nobody
 * is obliged to act on. Triaged in the admin control plane.
 */
export const complianceReports = pgTable(
  "compliance_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    videoId: uuid("video_id").references(() => videos.id, { onDelete: "set null" }),
    videoTitle: varchar("video_title", { length: 255 }).notNull(),
    reason: reportReasonEnum("reason").notNull(),
    details: text("details").notNull(),
    reporterEmail: varchar("reporter_email", { length: 255 }).notNull(),
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
    status: reportStatusEnum("status").default("OPEN").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => ({
    statusIdx: index("compliance_reports_status_idx").on(table.status, table.createdAt),
  })
);
