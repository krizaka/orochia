import { customType } from "drizzle-orm/pg-core";
import { sql, type SQL } from "drizzle-orm";

/**
 * Full-text search, in PostgreSQL only (no search service). Videos, stories and profiles carry a stored, generated
 * `search_vector` (GIN-indexed) built by `orochia_search_vector(title, tags, body)` — migration 0004_explore_search:
 * the text unaccented (`orochia_unaccent`: the `unaccent` extension when the database allows it, a built-in
 * transliteration otherwise), indexed with the `simple`, `english` and `french` dictionaries (title and tags weigh A,
 * the body B). Queries go through the same functions (apps/web/lib/search.ts), so "cafe" finds "Café".
 */
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

/** The generated expression of a `search_vector` column: a title, optional tags, an optional body. */
export function searchVectorOf(title: SQL, tags: SQL | null, body: SQL | null): SQL {
  return sql`orochia_search_vector(${title}, ${tags ?? sql`null::text[]`}, ${body ?? sql`null::text`})`;
}
