-- Recommendations served by Orazaka (ADR-078, krizaka/orochia#226): the outbox of interaction events and erasures, the
-- catalogue Orazaka holds, and versioned application settings. Version 1 of the recommendations settings is seeded
-- switched off: an operator publishes a new version (with its reason) to turn the shelves on.
DO $$ BEGIN CREATE TYPE "public"."reco_outbox_kind" AS ENUM('EVENT', 'ERASURE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_settings" (
	"domain" varchar(40) NOT NULL,
	"version" integer NOT NULL,
	"settings" jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_by" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_domain_version_pk" PRIMARY KEY("domain","version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reco_item_sync" (
	"video_id" uuid PRIMARY KEY NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reco_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dedup_key" varchar(120),
	"kind" "reco_outbox_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" varchar(40)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reco_outbox_dedup_idx" ON "reco_outbox" USING btree ("dedup_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reco_outbox_pending_idx" ON "reco_outbox" USING btree ("next_attempt_at") WHERE "reco_outbox"."sent_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reco_outbox_sent_idx" ON "reco_outbox" USING btree ("sent_at");
--> statement-breakpoint
INSERT INTO "app_settings" ("domain", "version", "settings", "reason", "created_by") VALUES ('recommendations', 1, '{
  "enabled": false, "timeoutMs": 800, "syncTimeoutMs": 10000, "forYouLimit": 12, "similarLimit": 6,
  "outboxBatch": 200, "outboxIntervalSeconds": 15, "retryBaseSeconds": 15, "retryMaxSeconds": 3600, "maxAttempts": 20,
  "sentRetentionDays": 7, "catalogueIntervalSeconds": 300, "catalogueBatch": 50
}'::jsonb, 'ADR-078: version 1, switched off until Orazaka serves the tenant', 'migration') ON CONFLICT DO NOTHING;
