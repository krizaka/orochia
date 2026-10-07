CREATE TYPE "public"."collection_visibility" AS ENUM('PUBLIC', 'APPROVED_FOLLOWERS_ONLY', 'CONTACTS_ONLY', 'INVITED_ONLY', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."contact_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."follow_status" AS ENUM('PENDING', 'APPROVED');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('TIP_RECEIVED', 'PLATFORM_FEE', 'CREATOR_CREDIT', 'PAYOUT_REQUESTED', 'PAYOUT_COMPLETED', 'REFUND');--> statement-breakpoint
CREATE TYPE "public"."payment_gateway" AS ENUM('CCBILL', 'SEGPAY', 'CRYPTO', 'STRIPE');--> statement-breakpoint
CREATE TYPE "public"."payment_intent_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('REQUESTED', 'UNDER_REVIEW', 'PROCESSING', 'SETTLED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('NON_CONSENSUAL', 'UNDERAGE', 'DMCA_COPYRIGHT', 'TERMS_VIOLATION', 'FRAUD_SCAM');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('OPEN', 'IN_REVIEW', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."share_channel" AS ENUM('LINK', 'X', 'WHATSAPP', 'TELEGRAM', 'EMAIL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'CREATOR', 'MEMBER');--> statement-breakpoint
CREATE TYPE "public"."video_status" AS ENUM('PENDING_UPLOAD', 'PROCESSING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."video_visibility" AS ENUM('PUBLIC', 'CONTACTS_ONLY', 'APPROVED_FOLLOWERS_ONLY', 'TIPPED_UNLOCKED', 'INVITED_ONLY');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" varchar(100),
	"bio" text,
	"avatar_url" text,
	"banner_url" text,
	"website_url" text,
	"twitter_handle" varchar(100),
	"min_tip_amount_cents" integer DEFAULT 500 NOT NULL,
	"payout_address_crypto" text,
	"payout_account_ccbill" varchar(100),
	"total_views" integer DEFAULT 0 NOT NULL,
	"total_tips_earned_cents" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'MEMBER' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_age_verified" boolean DEFAULT false NOT NULL,
	"suspended_at" timestamp with time zone,
	"suspension_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"status" "contact_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"status" "follow_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "video_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"granted_via" varchar(50) DEFAULT 'TIP_PAYMENT' NOT NULL,
	"amount_paid_cents" integer NOT NULL,
	"transaction_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"bunny_video_id" varchar(120) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"visibility" "video_visibility" DEFAULT 'PUBLIC' NOT NULL,
	"status" "video_status" DEFAULT 'PENDING_UPLOAD' NOT NULL,
	"min_tip_amount_cents" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"thumbnail_url" text,
	"preview_animation_url" text,
	"views_count" integer DEFAULT 0 NOT NULL,
	"tips_count" integer DEFAULT 0 NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"shares_count" integer DEFAULT 0 NOT NULL,
	"comments_enabled" boolean DEFAULT true NOT NULL,
	"resolutions" text[],
	"tags" text[],
	"removed_at" timestamp with time zone,
	"removal_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_bunny_video_id_unique" UNIQUE("bunny_video_id")
);
--> statement-breakpoint
CREATE TABLE "playlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"visibility" "collection_visibility" DEFAULT 'PRIVATE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "audience_list_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audience_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlist_audience_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"list_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_audience_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"list_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_viewers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gateway" "payment_gateway" NOT NULL,
	"gateway_session_id" varchar(255),
	"sender_id" uuid,
	"creator_id" uuid NOT NULL,
	"video_id" uuid,
	"amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" "payment_intent_status" DEFAULT 'PENDING' NOT NULL,
	"gateway_transaction_ref" varchar(255),
	"ledger_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payout_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "payout_status" DEFAULT 'REQUESTED' NOT NULL,
	"payout_method" varchar(50) NOT NULL,
	"payout_destination" text NOT NULL,
	"tx_hash_or_reference" text,
	"failure_reason" text,
	"reviewed_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tips_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_type" "ledger_entry_type" NOT NULL,
	"sender_id" uuid,
	"creator_id" uuid NOT NULL,
	"video_id" uuid,
	"gross_amount_cents" integer NOT NULL,
	"platform_fee_cents" integer DEFAULT 0 NOT NULL,
	"net_amount_cents" integer NOT NULL,
	"gateway" "payment_gateway" NOT NULL,
	"gateway_transaction_ref" varchar(255) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid,
	"video_title" varchar(255) NOT NULL,
	"reason" "report_reason" NOT NULL,
	"details" text NOT NULL,
	"reporter_email" varchar(255) NOT NULL,
	"reporter_id" uuid,
	"status" "report_status" DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_access_grants" ADD CONSTRAINT "video_access_grants_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_access_grants" ADD CONSTRAINT "video_access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_members" ADD CONSTRAINT "playlist_members_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_members" ADD CONSTRAINT "playlist_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "audience_list_members" ADD CONSTRAINT "audience_list_members_list_id_audience_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."audience_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_list_members" ADD CONSTRAINT "audience_list_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_lists" ADD CONSTRAINT "audience_lists_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_audience_lists" ADD CONSTRAINT "playlist_audience_lists_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_audience_lists" ADD CONSTRAINT "playlist_audience_lists_list_id_audience_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."audience_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_audience_lists" ADD CONSTRAINT "video_audience_lists_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_audience_lists" ADD CONSTRAINT "video_audience_lists_list_id_audience_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."audience_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_viewers" ADD CONSTRAINT "video_viewers_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_viewers" ADD CONSTRAINT "video_viewers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips_ledger" ADD CONSTRAINT "tips_ledger_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips_ledger" ADD CONSTRAINT "tips_ledger_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips_ledger" ADD CONSTRAINT "tips_ledger_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_pair_idx" ON "contacts" USING btree ("requester_id","addressee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "follows_pair_idx" ON "follows" USING btree ("follower_id","creator_id");--> statement-breakpoint
CREATE INDEX "follows_creator_status_idx" ON "follows" USING btree ("creator_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "video_access_user_idx" ON "video_access_grants" USING btree ("video_id","user_id");--> statement-breakpoint
CREATE INDEX "videos_creator_idx" ON "videos" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "videos_visibility_idx" ON "videos" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "videos_status_idx" ON "videos" USING btree ("status");--> statement-breakpoint
CREATE INDEX "videos_created_at_idx" ON "videos" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "playlist_items_position_idx" ON "playlist_items" USING btree ("playlist_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_video_unique_idx" ON "playlist_items" USING btree ("playlist_id","video_id");--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_members_unique_idx" ON "playlist_members" USING btree ("playlist_id","user_id");--> statement-breakpoint
CREATE INDEX "playlist_members_user_idx" ON "playlist_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "playlists_creator_idx" ON "playlists" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "video_comments_video_created_idx" ON "video_comments" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE INDEX "video_comments_parent_idx" ON "video_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_likes_once_idx" ON "video_likes" USING btree ("video_id","user_id");--> statement-breakpoint
CREATE INDEX "video_likes_user_idx" ON "video_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "video_shares_video_idx" ON "video_shares" USING btree ("video_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_views_once_per_day_idx" ON "video_views" USING btree ("video_id","viewer_key","viewed_on");--> statement-breakpoint
CREATE INDEX "video_views_video_day_idx" ON "video_views" USING btree ("video_id","viewed_on");--> statement-breakpoint
CREATE UNIQUE INDEX "audience_list_members_unique_idx" ON "audience_list_members" USING btree ("list_id","user_id");--> statement-breakpoint
CREATE INDEX "audience_list_members_user_idx" ON "audience_list_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audience_lists_owner_name_idx" ON "audience_lists" USING btree ("owner_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "playlist_audience_lists_unique_idx" ON "playlist_audience_lists" USING btree ("playlist_id","list_id");--> statement-breakpoint
CREATE INDEX "playlist_audience_lists_list_idx" ON "playlist_audience_lists" USING btree ("list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_audience_lists_unique_idx" ON "video_audience_lists" USING btree ("video_id","list_id");--> statement-breakpoint
CREATE INDEX "video_audience_lists_list_idx" ON "video_audience_lists" USING btree ("list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "video_viewers_unique_idx" ON "video_viewers" USING btree ("video_id","user_id");--> statement-breakpoint
CREATE INDEX "video_viewers_user_idx" ON "video_viewers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_intents_sender_idx" ON "payment_intents" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "payment_intents_status_idx" ON "payment_intents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payout_requests_creator_status_idx" ON "payout_requests" USING btree ("creator_id","status");--> statement-breakpoint
CREATE INDEX "tips_ledger_creator_idx" ON "tips_ledger" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "tips_ledger_sender_idx" ON "tips_ledger" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "tips_ledger_video_idx" ON "tips_ledger" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "tips_ledger_created_at_idx" ON "tips_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tips_ledger_credit_once_idx" ON "tips_ledger" USING btree ("gateway","gateway_transaction_ref") WHERE entry_type = 'CREATOR_CREDIT';--> statement-breakpoint
CREATE INDEX "compliance_reports_status_idx" ON "compliance_reports" USING btree ("status","created_at");