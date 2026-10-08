CREATE TYPE "public"."auction_bid_status" AS ENUM('LEADING', 'OUTBID', 'WON', 'RELEASED');--> statement-breakpoint
CREATE TYPE "public"."auction_rights" AS ENUM('WATCH', 'DOWNLOAD');--> statement-breakpoint
CREATE TYPE "public"."auction_settlement" AS ENUM('CREATOR_DECIDES', 'HIGHEST_BID');--> statement-breakpoint
CREATE TYPE "public"."auction_status" AS ENUM('OPEN', 'AWAITING_DECISION', 'SOLD', 'DECLINED', 'UNSOLD', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('GOOGLE', 'FACEBOOK');--> statement-breakpoint
CREATE TYPE "public"."auth_token_purpose" AS ENUM('VERIFY_EMAIL', 'RESET_PASSWORD');--> statement-breakpoint
CREATE TYPE "public"."collection_visibility" AS ENUM('PUBLIC', 'APPROVED_FOLLOWERS_ONLY', 'CONTACTS_ONLY', 'INVITED_ONLY', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."contact_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."follow_status" AS ENUM('PENDING', 'APPROVED');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('TIP_RECEIVED', 'PLATFORM_FEE', 'CREATOR_CREDIT', 'PAYOUT_REQUESTED', 'PAYOUT_COMPLETED', 'REFUND');--> statement-breakpoint
CREATE TYPE "public"."payment_gateway" AS ENUM('CCBILL', 'SEGPAY', 'CRYPTO', 'STRIPE', 'CREDITS');--> statement-breakpoint
CREATE TYPE "public"."payment_intent_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('REQUESTED', 'UNDER_REVIEW', 'PROCESSING', 'SETTLED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('NON_CONSENSUAL', 'UNDERAGE', 'DMCA_COPYRIGHT', 'TERMS_VIOLATION', 'FRAUD_SCAM');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('OPEN', 'IN_REVIEW', 'RESOLVED');--> statement-breakpoint
CREATE TYPE "public"."share_channel" AS ENUM('LINK', 'X', 'WHATSAPP', 'TELEGRAM', 'EMAIL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'CREATOR', 'MEMBER');--> statement-breakpoint
CREATE TYPE "public"."video_status" AS ENUM('PENDING_UPLOAD', 'PROCESSING', 'READY', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."video_visibility" AS ENUM('PUBLIC', 'CONTACTS_ONLY', 'APPROVED_FOLLOWERS_ONLY', 'TIPPED_UNLOCKED', 'INVITED_ONLY', 'AUCTION');--> statement-breakpoint
CREATE TYPE "public"."wallet_entry_type" AS ENUM('TOPUP', 'SPEND', 'REFUND', 'ADJUSTMENT', 'HOLD', 'RELEASE');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" varchar(100),
	"bio" text,
	"avatar_url" text,
	"banner_url" text,
	"website_url" text,
	"social_links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notifications_off" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"in_app_off" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"email_frequency" varchar(10) DEFAULT 'INSTANT' NOT NULL,
	"last_activity_email_at" timestamp with time zone,
	"direct_message_privacy" varchar(20) DEFAULT 'EVERYONE' NOT NULL,
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
	"date_of_birth" date,
	"email_verified_at" timestamp with time zone,
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
	"can_download" boolean DEFAULT false NOT NULL,
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
	"content_rating_id" varchar(30),
	"is_blurred" boolean DEFAULT false NOT NULL,
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
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "auth_token_purpose" NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "auth_provider" NOT NULL,
	"provider_user_id" varchar(191) NOT NULL,
	"email" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"media_type" varchar(20) DEFAULT 'IMAGE' NOT NULL,
	"bunny_video_id" varchar(120),
	"media_url" text,
	"thumbnail_url" text,
	"caption" varchar(280),
	"visibility" "video_visibility" DEFAULT 'PUBLIC' NOT NULL,
	"audience_list_id" uuid,
	"content_rating_id" varchar(30),
	"is_blurred" boolean DEFAULT false NOT NULL,
	"status" "video_status" DEFAULT 'READY' NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"views_count" integer DEFAULT 0 NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"tips_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"viewer_id" uuid,
	"viewer_key" varchar(80) NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event" varchar(40) NOT NULL,
	"actor_id" uuid,
	"vars" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"path" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_topups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"credits_cents" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"gateway" "payment_gateway" NOT NULL,
	"status" "payment_intent_status" DEFAULT 'PENDING' NOT NULL,
	"gateway_transaction_ref" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payout_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"method" varchar(30) NOT NULL,
	"holder_name" varchar(120) NOT NULL,
	"country" varchar(2) NOT NULL,
	"details_encrypted" text NOT NULL,
	"display_hint" varchar(80) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_type" "wallet_entry_type" NOT NULL,
	"amount_cents" integer NOT NULL,
	"reference" varchar(120) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_ratings" (
	"id" varchar(30) PRIMARY KEY NOT NULL,
	"label" varchar(50) NOT NULL,
	"description" text,
	"is_adult" boolean DEFAULT false NOT NULL,
	"requires_blur" boolean DEFAULT false NOT NULL,
	"default_tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"min_age" integer DEFAULT 0 NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"icon_name" varchar(50) DEFAULT 'shield' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"code" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_invitations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "blocked_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant1_id" uuid NOT NULL,
	"participant2_id" uuid NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auction_bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auction_id" uuid NOT NULL,
	"bidder_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "auction_bid_status" DEFAULT 'LEADING' NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"status" "auction_status" DEFAULT 'OPEN' NOT NULL,
	"rights" "auction_rights" DEFAULT 'WATCH' NOT NULL,
	"settlement" "auction_settlement" DEFAULT 'CREATOR_DECIDES' NOT NULL,
	"starting_price_cents" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"scheduled_ends_at" timestamp with time zone NOT NULL,
	"decision_deadline" timestamp with time zone,
	"highest_bid_cents" integer DEFAULT 0 NOT NULL,
	"bids_count" integer DEFAULT 0 NOT NULL,
	"leading_bid_id" uuid,
	"leader_id" uuid,
	"previous_visibility" "video_visibility" NOT NULL,
	"closed_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "videos" ADD CONSTRAINT "videos_content_rating_id_content_ratings_id_fk" FOREIGN KEY ("content_rating_id") REFERENCES "public"."content_ratings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips_ledger" ADD CONSTRAINT "tips_ledger_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips_ledger" ADD CONSTRAINT "tips_ledger_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips_ledger" ADD CONSTRAINT "tips_ledger_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_audience_list_id_audience_lists_id_fk" FOREIGN KEY ("audience_list_id") REFERENCES "public"."audience_lists"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_content_rating_id_content_ratings_id_fk" FOREIGN KEY ("content_rating_id") REFERENCES "public"."content_ratings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_likes" ADD CONSTRAINT "story_likes_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_likes" ADD CONSTRAINT "story_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_views" ADD CONSTRAINT "story_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_drafts" ADD CONSTRAINT "video_drafts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant1_id_users_id_fk" FOREIGN KEY ("participant1_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant2_id_users_id_fk" FOREIGN KEY ("participant2_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_auction_id_auctions_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auctions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction_bids" ADD CONSTRAINT "auction_bids_bidder_id_users_id_fk" FOREIGN KEY ("bidder_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
CREATE UNIQUE INDEX "auth_tokens_hash_idx" ON "auth_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_tokens_user_purpose_idx" ON "auth_tokens" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_user_idx" ON "auth_identities" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "auth_identities_user_idx" ON "auth_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_intents_sender_idx" ON "payment_intents" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "payment_intents_status_idx" ON "payment_intents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payout_requests_creator_status_idx" ON "payout_requests" USING btree ("creator_id","status");--> statement-breakpoint
CREATE INDEX "tips_ledger_creator_idx" ON "tips_ledger" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "tips_ledger_sender_idx" ON "tips_ledger" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "tips_ledger_video_idx" ON "tips_ledger" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "tips_ledger_created_at_idx" ON "tips_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tips_ledger_credit_once_idx" ON "tips_ledger" USING btree ("gateway","gateway_transaction_ref") WHERE entry_type = 'CREATOR_CREDIT';--> statement-breakpoint
CREATE INDEX "compliance_reports_status_idx" ON "compliance_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "stories_creator_idx" ON "stories" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "stories_expires_at_idx" ON "stories" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "stories_created_at_idx" ON "stories" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stories_bunny_video_idx" ON "stories" USING btree ("bunny_video_id") WHERE bunny_video_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "story_likes_unique_idx" ON "story_likes" USING btree ("story_id","user_id");--> statement-breakpoint
CREATE INDEX "story_views_story_viewer_idx" ON "story_views" USING btree ("story_id","viewer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "story_views_once_idx" ON "story_views" USING btree ("story_id","viewer_key");--> statement-breakpoint
CREATE INDEX "video_drafts_owner_idx" ON "video_drafts" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "video_drafts_expires_at_idx" ON "video_drafts" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "video_drafts_bunny_video_idx" ON "video_drafts" USING btree ("bunny_video_id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE read_at is null;--> statement-breakpoint
CREATE INDEX "credit_topups_user_idx" ON "credit_topups" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "wallet_ledger_user_idx" ON "wallet_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ledger_reference_idx" ON "wallet_ledger" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "user_invitations_inviter_idx" ON "user_invitations" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "user_invitations_email_idx" ON "user_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_invitations_code_idx" ON "user_invitations" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "blocked_users_pair_idx" ON "blocked_users" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "blocked_users_blocker_idx" ON "blocked_users" USING btree ("blocker_id");--> statement-breakpoint
CREATE INDEX "blocked_users_blocked_idx" ON "blocked_users" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "conversations_participant1_idx" ON "conversations" USING btree ("participant1_id");--> statement-breakpoint
CREATE INDEX "conversations_participant2_idx" ON "conversations" USING btree ("participant2_id");--> statement-breakpoint
CREATE INDEX "conversations_last_message_at_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "direct_messages_conversation_idx" ON "direct_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "direct_messages_sender_idx" ON "direct_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "direct_messages_recipient_idx" ON "direct_messages" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "direct_messages_created_at_idx" ON "direct_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auction_bids_auction_idx" ON "auction_bids" USING btree ("auction_id","created_at");--> statement-breakpoint
CREATE INDEX "auction_bids_bidder_idx" ON "auction_bids" USING btree ("bidder_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auction_bids_one_leader_idx" ON "auction_bids" USING btree ("auction_id") WHERE status = 'LEADING';--> statement-breakpoint
CREATE UNIQUE INDEX "auctions_one_active_per_video_idx" ON "auctions" USING btree ("video_id") WHERE status in ('OPEN', 'AWAITING_DECISION', 'SOLD');--> statement-breakpoint
CREATE INDEX "auctions_status_ends_idx" ON "auctions" USING btree ("status","ends_at");--> statement-breakpoint
CREATE INDEX "auctions_decision_deadline_idx" ON "auctions" USING btree ("decision_deadline") WHERE status = 'AWAITING_DECISION';--> statement-breakpoint
CREATE INDEX "auctions_creator_idx" ON "auctions" USING btree ("creator_id","created_at");--> statement-breakpoint
-- Reference data every environment needs (videos and stories point at it): the five content ratings, in English.
-- Upserted, so a database that already has them (development seed) gets the same wording.
INSERT INTO "content_ratings" ("id", "label", "description", "is_adult", "requires_blur", "default_tags", "min_age", "display_order", "icon_name") VALUES
  ('FOR_KIDS', 'Kids safe', 'Suitable for children and families: no strong language, no violence.', false, false, ARRAY['family','kids']::text[], 0, 1, 'baby'),
  ('GENERAL', 'General audience', 'Suitable for most viewers.', false, false, ARRAY['general']::text[], 0, 2, 'users'),
  ('TEEN', 'Teens (13+)', 'Suitable from 13. May touch on more mature themes.', false, false, ARRAY['teen']::text[], 13, 3, 'user-check'),
  ('MATURE', 'Mature (18+)', 'Adults only. Sensitive or intense themes.', true, false, ARRAY['mature','18+']::text[], 18, 4, 'shield-alert'),
  ('ADULT', 'Adult explicit (18+)', 'Explicit content for verified adults. The preview is blurred by default.', true, true, ARRAY['adult','18+']::text[], 18, 5, 'alert-triangle')
ON CONFLICT ("id") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "is_adult" = EXCLUDED."is_adult",
  "requires_blur" = EXCLUDED."requires_blur",
  "min_age" = EXCLUDED."min_age",
  "display_order" = EXCLUDED."display_order";
