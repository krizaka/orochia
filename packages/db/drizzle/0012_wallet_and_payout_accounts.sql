CREATE TYPE "public"."wallet_entry_type" AS ENUM('TOPUP', 'SPEND', 'REFUND', 'ADJUSTMENT');--> statement-breakpoint
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
ALTER TABLE "credit_topups" ADD CONSTRAINT "credit_topups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_topups_user_idx" ON "credit_topups" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "wallet_ledger_user_idx" ON "wallet_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ledger_reference_idx" ON "wallet_ledger" USING btree ("reference");