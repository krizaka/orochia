ALTER TABLE "stories" ALTER COLUMN "media_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ALTER COLUMN "visibility" DROP DEFAULT;--> statement-breakpoint
-- The free-text audiences become the video rules: SUBSCRIBERS_ONLY never existed, it meant approved followers.
UPDATE "stories" SET "visibility" = 'APPROVED_FOLLOWERS_ONLY' WHERE "visibility" NOT IN ('PUBLIC', 'CONTACTS_ONLY', 'APPROVED_FOLLOWERS_ONLY', 'INVITED_ONLY');--> statement-breakpoint
ALTER TABLE "stories" ALTER COLUMN "visibility" SET DATA TYPE "public"."video_visibility" USING "visibility"::"public"."video_visibility";--> statement-breakpoint
ALTER TABLE "stories" ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC'::"public"."video_visibility";--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "audience_list_id" uuid;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "status" "video_status" DEFAULT 'READY' NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN "duration_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "story_views" ADD COLUMN "viewer_key" varchar(80);--> statement-breakpoint
-- Existing views get their key, then repeated views of the same story by the same viewer are folded into one.
UPDATE "story_views" SET "viewer_key" = COALESCE('u:' || "viewer_id"::text, 'g:' || "ip_hash", 'x:' || "id"::text);--> statement-breakpoint
DELETE FROM "story_views" a USING "story_views" b WHERE a."story_id" = b."story_id" AND a."viewer_key" = b."viewer_key" AND a."id" > b."id";--> statement-breakpoint
UPDATE "stories" SET "views_count" = (SELECT count(*) FROM "story_views" v WHERE v."story_id" = "stories"."id");--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_audience_list_id_audience_lists_id_fk" FOREIGN KEY ("audience_list_id") REFERENCES "public"."audience_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stories_bunny_video_idx" ON "stories" USING btree ("bunny_video_id") WHERE bunny_video_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "story_views_once_idx" ON "story_views" USING btree ("story_id","viewer_key");