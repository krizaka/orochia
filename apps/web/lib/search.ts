import { type AnyColumn,type SQL, sql } from "drizzle-orm";

/**
 * Full-text queries over the generated `search_vector` columns (migration 0004_explore_search). A query matches when
 * every word is found — as a stem in English or French (`websearch_to_tsquery`: "quoted phrases", -exclusions), or as
 * the beginning of a word (`tokyo neo` finds "Tokyo Neon", while the visitor is still typing). Accents never matter:
 * the query goes through the same `orochia_unaccent` as the documents.
 */

const MAX_TERMS = 8;

/** The words of a query, unaccented and lower case, letters and digits only — safe inside `to_tsquery`. */
export function queryTerms(q: string): string[] {
  return q
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, MAX_TERMS);
}

/** `tokyo neo` → `tokyo:* & neo:*` (null when nothing searchable is left). */
export function prefixQuery(q: string): string | null {
  const terms = queryTerms(q);
  return terms.length ? terms.map((t) => `${t}:*`).join(" & ") : null;
}

/** The tsquery of a search: English stems ∪ French stems ∪ word prefixes. */
export function tsQuery(q: string): SQL {
  const text = q.slice(0, 200);
  const prefix = prefixQuery(text);
  const stems = sql`(websearch_to_tsquery('english', orochia_unaccent(${text})) || websearch_to_tsquery('french', orochia_unaccent(${text})))`;
  return prefix ? sql`(${stems} || to_tsquery('simple', ${prefix}))` : stems;
}

/** `vector @@ query`. */
export function matches(vector: AnyColumn | SQL, q: string): SQL {
  return sql`${vector} @@ ${tsQuery(q)}`;
}

/** The relevance of a match (title and tags weigh more than the body). */
export function rank(vector: AnyColumn | SQL, q: string): SQL<number> {
  return sql<number>`ts_rank_cd(${vector}, ${tsQuery(q)})`;
}

/** `ILIKE` on a prefix, wildcards in the input escaped (usernames: `@eli` finds `elenavox`). */
export function startsWith(column: AnyColumn, q: string): SQL {
  const term = q.trim().replace(/^@/, "").replace(/[%_\\]/g, (c) => `\\${c}`);
  return sql`${column} ilike ${`${term}%`}`;
}
