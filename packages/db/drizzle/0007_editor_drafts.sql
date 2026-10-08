CREATE TABLE "video_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" varchar(10) NOT NULL,
	"bunny_video_id" varchar(120) NOT NULL,
	"status" "video_status" DEFAULT 'PENDING_UPLOAD' NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"edit" jsonb NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"music_ref" text,
	"music_name" varchar(255),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_drafts" ADD CONSTRAINT "video_drafts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_drafts_owner_idx" ON "video_drafts" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "video_drafts_expires_at_idx" ON "video_drafts" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "video_drafts_bunny_video_idx" ON "video_drafts" USING btree ("bunny_video_id");