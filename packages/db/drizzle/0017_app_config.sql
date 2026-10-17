CREATE TABLE "app_config" (
	"platform" varchar(16) PRIMARY KEY NOT NULL,
	"min_supported_version" varchar(32) DEFAULT '0.0.0' NOT NULL,
	"latest_version" varchar(32) DEFAULT '0.0.0' NOT NULL,
	"update_override" varchar(8),
	"store_url" text,
	"maintenance_on" boolean DEFAULT false NOT NULL,
	"maintenance_message" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"message" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"contract_min" integer DEFAULT 1 NOT NULL,
	"contract_max" integer DEFAULT 1 NOT NULL,
	"contract_sunset" date,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(255) DEFAULT 'seed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_config_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" varchar(16) NOT NULL,
	"revision" integer NOT NULL,
	"min_supported_version" varchar(32) NOT NULL,
	"latest_version" varchar(32) NOT NULL,
	"update_override" varchar(8),
	"store_url" text,
	"maintenance_on" boolean NOT NULL,
	"maintenance_message" jsonb NOT NULL,
	"message" jsonb NOT NULL,
	"contract_min" integer NOT NULL,
	"contract_max" integer NOT NULL,
	"contract_sunset" date,
	"flags" jsonb NOT NULL,
	"reason" text NOT NULL,
	"changed_by" varchar(255) NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_config_history_revision" UNIQUE("platform","revision")
);
--> statement-breakpoint
-- Seeded permissive: no minimum, no maintenance, one contract. Nobody is blocked until an operator publishes values.
INSERT INTO "app_config" ("platform") VALUES ('ios'), ('android'), ('macos'), ('windows'), ('linux'), ('web') ON CONFLICT ("platform") DO NOTHING;
--> statement-breakpoint
INSERT INTO "app_config_history" ("platform", "revision", "min_supported_version", "latest_version", "update_override", "store_url", "maintenance_on", "maintenance_message", "message", "contract_min", "contract_max", "contract_sunset", "flags", "reason", "changed_by", "changed_at")
SELECT "platform", "revision", "min_supported_version", "latest_version", "update_override", "store_url", "maintenance_on", "maintenance_message", "message", "contract_min", "contract_max", "contract_sunset", "flags", 'seed', "updated_by", "updated_at" FROM "app_config"
ON CONFLICT ("platform", "revision") DO NOTHING;
