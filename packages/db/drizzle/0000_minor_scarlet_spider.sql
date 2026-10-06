DO $$ BEGIN
 CREATE TYPE "public"."contact_status" AS ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ledger_entry_type" AS ENUM('TIP_RECEIVED', 'PLATFORM_FEE', 'CREATOR_CREDIT', 'PAYOUT_REQUESTED', 'PAYOUT_COMPLETED', 'REFUND');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_gateway" AS ENUM('CCBILL', 'SEGPAY', 'CRYPTO', 'STRIPE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payout_status" AS ENUM('REQUESTED', 'UNDER_REVIEW', 'PROCESSING', 'SETTLED', 'FAILED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'CREATOR', 'MEMBER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."video_status" AS ENUM('PENDING_UPLOAD', 'PROCESSING', 'READY', 'FAILED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."video_visibility" AS ENUM('PUBLIC', 'CONTACTS_ONLY', 'APPROVED_FOLLOWERS_ONLY', 'TIPPED_UNLOCKED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "profiles" (
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
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'MEMBER' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_age_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" uuid NOT NULL,
	"addressee_id" uuid NOT NULL,
	"status" "contact_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_access_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"granted_via" varchar(50) DEFAULT 'TIP_PAYMENT' NOT NULL,
	"amount_paid_cents" integer NOT NULL,
	"transaction_ref" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "videos" (
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
	"resolutions" text[],
	"tags" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_bunny_video_id_unique" UNIQUE("bunny_video_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payout_requests" (
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
CREATE TABLE IF NOT EXISTS "tips_ledger" (
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
DO $$ BEGIN
 ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "video_access_grants" ADD CONSTRAINT "video_access_grants_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "video_access_grants" ADD CONSTRAINT "video_access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "videos" ADD CONSTRAINT "videos_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "playlists" ADD CONSTRAINT "playlists_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tips_ledger" ADD CONSTRAINT "tips_ledger_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tips_ledger" ADD CONSTRAINT "tips_ledger_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tips_ledger" ADD CONSTRAINT "tips_ledger_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_pair_idx" ON "contacts" USING btree ("requester_id","addressee_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "video_access_user_idx" ON "video_access_grants" USING btree ("video_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_creator_idx" ON "videos" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_visibility_idx" ON "videos" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_status_idx" ON "videos" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_created_at_idx" ON "videos" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playlist_items_position_idx" ON "playlist_items" USING btree ("playlist_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "playlist_video_unique_idx" ON "playlist_items" USING btree ("playlist_id","video_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playlists_creator_idx" ON "playlists" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_requests_creator_status_idx" ON "payout_requests" USING btree ("creator_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tips_ledger_creator_idx" ON "tips_ledger" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tips_ledger_sender_idx" ON "tips_ledger" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tips_ledger_video_idx" ON "tips_ledger" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tips_ledger_created_at_idx" ON "tips_ledger" USING btree ("created_at");