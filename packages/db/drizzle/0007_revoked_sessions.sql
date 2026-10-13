CREATE TABLE IF NOT EXISTS "revoked_sessions" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revoked_sessions_expires_at_idx" ON "revoked_sessions" USING btree ("expires_at");