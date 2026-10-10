import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { prefixQuery, queryTerms, tsQuery } from "./search";

describe("search queries", () => {
  it("terms are unaccented, lower case, letters and digits only", () => {
    expect(queryTerms("  Café  CRÈME, Tokyo-2026 ")).toEqual(["cafe", "creme", "tokyo", "2026"]);
    expect(queryTerms("'; drop table users; --")).toEqual(["drop", "table", "users"]);
  });
  it("prefix query matches while typing, every word required", () => {
    expect(prefixQuery("tokyo neo")).toBe("tokyo:* & neo:*");
    expect(prefixQuery("%%%")).toBeNull();
  });
  it("the input is a parameter, never SQL", () => {
    const q = new PgDialect().sqlToQuery(tsQuery("x'); drop table videos; --"));
    expect(q.sql).not.toContain("drop table");
    expect(q.params).toContain("x'); drop table videos; --");
    expect(q.sql).toContain("websearch_to_tsquery('english'");
    expect(q.sql).toContain("websearch_to_tsquery('french'");
  });
});
