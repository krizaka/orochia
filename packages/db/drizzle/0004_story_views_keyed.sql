ALTER TABLE "story_views" ALTER COLUMN "viewer_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "story_views" DROP COLUMN "ip_hash";