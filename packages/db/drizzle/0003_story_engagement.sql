ALTER TABLE "payment_intents" ADD COLUMN IF NOT EXISTS "story_id" uuid;--> statement-breakpoint
ALTER TABLE "tips_ledger" ADD COLUMN IF NOT EXISTS "story_id" uuid;--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD COLUMN IF NOT EXISTS "story_id" uuid;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "story_id" uuid;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "tips_ledger" ADD CONSTRAINT "tips_ledger_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tips_ledger_story_idx" ON "tips_ledger" USING btree ("story_id");