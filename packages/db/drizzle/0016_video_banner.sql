ALTER TABLE "profiles" ADD COLUMN "banner_kind" varchar(20) DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "banner_video_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "banner_start_seconds" real;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "banner_end_seconds" real;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "banner_ambient_id" varchar(60);