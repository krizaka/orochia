-- The Explorer on Orazaka: what a video means, kept next to the video (pgvector), and the proof of every call to Orazaka.
-- pgvector: DigitalOcean managed PostgreSQL ships it; a database whose user cannot CREATE EXTENSION has it created once by
-- the cluster's admin. docs/DEPLOYMENT.md.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(16) NOT NULL,
	"orazaka_run_id" varchar(80),
	"model" varchar(80),
	"inputs" integer DEFAULT 0 NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"status" varchar(24) NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "explorer_embeddings" (
	"video_id" uuid PRIMARY KEY NOT NULL,
	"model" varchar(80) NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"run_id" varchar(80) NOT NULL,
	"embedded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "explorer_embeddings" ADD CONSTRAINT "explorer_embeddings_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_runs_created_idx" ON "ai_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "explorer_embeddings_embedding_idx" ON "explorer_embeddings" USING hnsw ("embedding" vector_cosine_ops);
