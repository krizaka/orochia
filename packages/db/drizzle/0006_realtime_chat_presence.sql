ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "show_presence" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "compliance_reports" ADD COLUMN IF NOT EXISTS "message_id" uuid;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "seq" bigserial NOT NULL;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "client_id" uuid;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;--> statement-breakpoint
-- Messages written before this migration: numbered in the order they were written (the new column numbered them in
-- storage order), and counted as delivered (they were shown already). Only on the first run: the unique index below
-- does not exist yet.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'direct_messages_seq_idx') THEN
    UPDATE "direct_messages" d SET "seq" = o.n FROM (SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS n FROM "direct_messages") o WHERE d."id" = o."id";
    PERFORM setval(pg_get_serial_sequence('direct_messages', 'seq'), GREATEST((SELECT max("seq") FROM "direct_messages"), 1));
    UPDATE "direct_messages" SET "delivered_at" = "created_at" WHERE "delivered_at" IS NULL;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "compliance_reports" ADD CONSTRAINT "compliance_reports_message_id_direct_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."direct_messages"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "direct_messages_seq_idx" ON "direct_messages" USING btree ("seq");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "direct_messages_conversation_seq_idx" ON "direct_messages" USING btree ("conversation_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "direct_messages_sender_client_idx" ON "direct_messages" USING btree ("sender_id","client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "direct_messages_unread_idx" ON "direct_messages" USING btree ("recipient_id") WHERE "direct_messages"."is_read" = false;
