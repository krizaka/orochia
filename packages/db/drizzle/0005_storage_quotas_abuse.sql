ALTER TYPE "public"."video_status" ADD VALUE IF NOT EXISTS 'HELD';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "storage_alerts" (
	"threshold" integer PRIMARY KEY NOT NULL,
	"alerted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_bytes" bigint NOT NULL,
	"limit_bytes" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "storage_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taken_at" timestamp with time zone DEFAULT now() NOT NULL,
	"library_bytes" bigint NOT NULL,
	"library_videos" integer NOT NULL,
	"library_seconds" integer DEFAULT 0 NOT NULL,
	"zone_bytes" bigint,
	"zone_files" integer,
	"app_bytes" bigint NOT NULL,
	"orphan_bytes" bigint DEFAULT 0 NOT NULL,
	"orphan_videos" integer DEFAULT 0 NOT NULL,
	"missing_videos" integer DEFAULT 0 NOT NULL,
	"updated_rows" integer DEFAULT 0 NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "storage_plan" varchar(40);--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "storage_bytes" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "storage_bytes" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "video_drafts" ADD COLUMN IF NOT EXISTS "storage_bytes" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limit_buckets_reset_at_idx" ON "rate_limit_buckets" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "storage_snapshots_taken_at_idx" ON "storage_snapshots" USING btree ("taken_at");--> statement-breakpoint
-- Drafts already held their original at Bunny: its declared size is the best known until the next reconciliation.
UPDATE "video_drafts" SET "storage_bytes" = "size_bytes" WHERE "storage_bytes" = 0;