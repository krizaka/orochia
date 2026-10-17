CREATE TABLE "conversation_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"max_uses" integer DEFAULT 50 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"muted_until" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"last_read_seq" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "conversation_members_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "participant1_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "participant2_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "direct_messages" ALTER COLUMN "recipient_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "kind" text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversation_invites" ADD CONSTRAINT "conversation_invites_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_invites" ADD CONSTRAINT "conversation_invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_invites_token_idx" ON "conversation_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "conversation_invites_conversation_idx" ON "conversation_invites" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversation_members_user_idx" ON "conversation_members" USING btree ("user_id") WHERE "conversation_members"."left_at" is null;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_kind_shape_check" CHECK ("conversations"."kind" in ('direct', 'group') and ("conversations"."kind" = 'group' or ("conversations"."participant1_id" is not null and "conversations"."participant2_id" is not null)));
--> statement-breakpoint
-- The 1:1 data: every existing conversation gets its two members (receipts stay on the messages).
INSERT INTO "conversation_members" ("conversation_id", "user_id", "joined_at")
SELECT "id", "participant1_id", "created_at" FROM "conversations" WHERE "participant1_id" IS NOT NULL
UNION ALL
SELECT "id", "participant2_id", "created_at" FROM "conversations" WHERE "participant2_id" IS NOT NULL
ON CONFLICT DO NOTHING;
