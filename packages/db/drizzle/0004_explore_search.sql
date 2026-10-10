-- Explore, phase 0 (#54): full-text search in PostgreSQL — no search service.
-- orochia_unaccent: lower case without accents. The `unaccent` extension when the database lets this user create it
-- (a trusted extension: local Docker, CI, a managed cluster's admin user); otherwise — a DigitalOcean dev database
-- refuses CREATE on the database — a built-in transliteration of the Latin accents. Both are IMMUTABLE, so a
-- generated column can use them; the functions are schema-qualified so a dump restores with an empty search_path.
DO $$
DECLARE ext_schema text;
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS unaccent;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'unaccent extension unavailable (%): using the built-in transliteration', SQLERRM;
  END;
  SELECT n.nspname INTO ext_schema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'unaccent';
  IF ext_schema IS NOT NULL THEN
    EXECUTE format($f$CREATE OR REPLACE FUNCTION public.orochia_unaccent(input text) RETURNS text
      LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
      AS $fn$ SELECT lower(%1$I.unaccent(%2$L::regdictionary, input)) $fn$ $f$, ext_schema, ext_schema || '.unaccent');
  ELSE
    CREATE OR REPLACE FUNCTION public.orochia_unaccent(input text) RETURNS text
      LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
      AS $body$ SELECT replace(replace(replace(translate(lower(input),
        'àáâãäåāăąçćĉċčďđèéêëēĕėęěĝğġģĥħìíîïĩīĭįıĵķĺļľŀłñńņňŉòóôõöøōŏőŕŗřśŝşšţťŧùúûüũūŭůűųŵýÿŷźżž',
        'aaaaaaaaacccccddeeeeeeeeegggghhiiiiiiiiijklllllnnnnnooooooooorrrsssstttuuuuuuuuuuwyyyzzz'),
        'æ', 'ae'), 'œ', 'oe'), 'ß', 'ss') $body$;
  END IF;
END $$;--> statement-breakpoint
-- The document of a video, a story or a profile: title and tags weigh A, the body B; each indexed with the simple
-- dictionary (exact words, prefixes, names) and the English and French ones (stems: "concerts" finds "concert").
CREATE OR REPLACE FUNCTION public.orochia_search_vector(title text, tags text[], body text) RETURNS tsvector
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $body$ SELECT
    setweight(to_tsvector('pg_catalog.simple'::regconfig, coalesce(public.orochia_unaccent(coalesce(title, '') || ' ' || coalesce(array_to_string(tags, ' '), '')), '')), 'A') ||
    setweight(to_tsvector('pg_catalog.english'::regconfig, coalesce(public.orochia_unaccent(title), '')), 'A') ||
    setweight(to_tsvector('pg_catalog.french'::regconfig, coalesce(public.orochia_unaccent(title), '')), 'A') ||
    setweight(to_tsvector('pg_catalog.simple'::regconfig, coalesce(public.orochia_unaccent(body), '')), 'B') ||
    setweight(to_tsvector('pg_catalog.english'::regconfig, coalesce(public.orochia_unaccent(body), '')), 'B') ||
    setweight(to_tsvector('pg_catalog.french'::regconfig, coalesce(public.orochia_unaccent(body), '')), 'B') $body$;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "search_vector" "tsvector" GENERATED ALWAYS AS (orochia_search_vector("display_name", null::text[], "bio")) STORED;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "search_vector" "tsvector" GENERATED ALWAYS AS (orochia_search_vector("title", "tags", "description")) STORED;--> statement-breakpoint
ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "search_vector" "tsvector" GENERATED ALWAYS AS (orochia_search_vector("caption", null::text[], null::text)) STORED;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_search_idx" ON "profiles" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_search_idx" ON "videos" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_tags_idx" ON "videos" USING gin ("tags");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stories_search_idx" ON "stories" USING gin ("search_vector");
