DO $$ BEGIN CREATE TYPE "public"."challenge_application_status" AS ENUM('PENDING', 'CHOSEN', 'NOT_CHOSEN', 'WITHDRAWN'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."challenge_deliverable" AS ENUM('VIDEO', 'STORY'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."challenge_kind" AS ENUM('GOAL', 'REQUEST', 'OPEN_CALL'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."challenge_pledge_status" AS ENUM('HELD', 'PAID', 'RELEASED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."challenge_reward" AS ENUM('BACKERS', 'EVERYONE'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."challenge_status" AS ENUM('OPEN', 'ACCEPTED', 'DELIVERED', 'DECLINED', 'EXPIRED', 'FAILED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
ALTER TYPE "public"."video_visibility" ADD VALUE IF NOT EXISTS 'CHALLENGE';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenge_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"note" varchar(280),
	"status" "challenge_application_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenge_pledges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"backer_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "challenge_pledge_status" DEFAULT 'HELD' NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "challenge_kind" NOT NULL,
	"status" "challenge_status" DEFAULT 'OPEN' NOT NULL,
	"author_id" uuid NOT NULL,
	"creator_id" uuid,
	"title" varchar(120) NOT NULL,
	"description" text NOT NULL,
	"deliverable" "challenge_deliverable" DEFAULT 'VIDEO' NOT NULL,
	"reward" "challenge_reward" DEFAULT 'BACKERS' NOT NULL,
	"goal_cents" integer,
	"pledged_cents" integer DEFAULT 0 NOT NULL,
	"backers_count" integer DEFAULT 0 NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"delivery_days" integer NOT NULL,
	"delivery_deadline" timestamp with time zone,
	"delivered_video_id" uuid,
	"delivered_story_id" uuid,
	"previous_visibility" "video_visibility",
	"accepted_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "challenge_requests_off" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "challenge_min_cents" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "challenge_applications" ADD CONSTRAINT "challenge_applications_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "challenge_applications" ADD CONSTRAINT "challenge_applications_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "challenge_pledges" ADD CONSTRAINT "challenge_pledges_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "challenge_pledges" ADD CONSTRAINT "challenge_pledges_backer_id_users_id_fk" FOREIGN KEY ("backer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "challenges" ADD CONSTRAINT "challenges_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "challenges" ADD CONSTRAINT "challenges_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "challenges" ADD CONSTRAINT "challenges_delivered_video_id_videos_id_fk" FOREIGN KEY ("delivered_video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "challenges" ADD CONSTRAINT "challenges_delivered_story_id_stories_id_fk" FOREIGN KEY ("delivered_story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "challenge_applications_once_idx" ON "challenge_applications" USING btree ("challenge_id","creator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenge_pledges_challenge_idx" ON "challenge_pledges" USING btree ("challenge_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenge_pledges_backer_idx" ON "challenge_pledges" USING btree ("backer_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenges_status_deadline_idx" ON "challenges" USING btree ("status","deadline");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenges_delivery_deadline_idx" ON "challenges" USING btree ("delivery_deadline") WHERE status = 'ACCEPTED';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenges_author_idx" ON "challenges" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenges_creator_idx" ON "challenges" USING btree ("creator_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "challenges_delivered_video_idx" ON "challenges" USING btree ("delivered_video_id") WHERE delivered_video_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "challenges_delivered_story_idx" ON "challenges" USING btree ("delivered_story_id") WHERE delivered_story_id is not null;