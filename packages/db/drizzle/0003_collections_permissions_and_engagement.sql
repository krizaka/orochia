CREATE TYPE "public"."collection_visibility" AS ENUM('PUBLIC', 'APPROVED_FOLLOWERS_ONLY', 'CONTACTS_ONLY', 'INVITED_ONLY', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."share_channel" AS ENUM('LINK', 'X', 'WHATSAPP', 'TELEGRAM', 'EMAIL', 'OTHER');--> statement-breakpoint
CREATE TABLE "playlist_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by" uuid
);
--> statement-breakpoint
CREATE TABLE "video_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"user_id" uuid,
	"channel" "share_channel" DEFAULT 'LINK' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"viewer_id" uuid,
	"viewer_key" varchar(80) NOT NULL,
	"viewed_on" date DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "likes_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "comments_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "shares_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "comments_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "visibility" "collection_visibility" DEFAULT 'PRIVATE' NOT NULL;--> statement-breakpoint
ALTER TABLE "playlist_members" ADD CONSTRAINT "playlist_members_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_members" ADD CONSTRAINT "playlist_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_comments" ADD CONSTRAINT "video_comments_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_comments" ADD CONSTRAINT "video_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_comments" ADD CONSTRAINT "video_comments_parent_id_video_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."video_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_comments" ADD CONSTRAINT "video_comments_removed_by_users_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_likes" ADD CONSTRAINT "video_likes_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_likes" ADD CONSTRAINT "video_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_shares" ADD CONSTRAINT "video_shares_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_shares" ADD CONSTRAINT "video_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_views" ADD CONSTRAINT "video_views_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_views" ADD CONSTRAINT "video_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_members_unique_idx" ON "playlist_members" USING btree ("playlist_id","user_id");--> statement-breakpoint
CREATE INDEX "playlist_members_user_idx" ON "playlist_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "video_comments_video_created_idx" ON "video_comments" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE INDEX "video_comments_parent_idx" ON "video_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_likes_once_idx" ON "video_likes" USING btree ("video_id","user_id");--> statement-breakpoint
CREATE INDEX "video_likes_user_idx" ON "video_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "video_shares_video_idx" ON "video_shares" USING btree ("video_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_views_once_per_day_idx" ON "video_views" USING btree ("video_id","viewer_key","viewed_on");--> statement-breakpoint
CREATE INDEX "video_views_video_day_idx" ON "video_views" USING btree ("video_id","viewed_on");--> statement-breakpoint
-- Existing collections keep their audience: private stays private, the others become public.
UPDATE "playlists" SET "visibility" = CASE WHEN "is_private" THEN 'PRIVATE'::"collection_visibility" ELSE 'PUBLIC'::"collection_visibility" END;
