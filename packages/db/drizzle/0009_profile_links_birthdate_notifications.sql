ALTER TABLE "profiles" ADD COLUMN "social_links" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "notifications_off" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
UPDATE "profiles" SET "social_links" = jsonb_build_object('x', "twitter_handle") WHERE "twitter_handle" IS NOT NULL AND "twitter_handle" <> '' AND "social_links" = '{}'::jsonb;
