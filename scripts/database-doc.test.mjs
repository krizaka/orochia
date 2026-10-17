import { describe, expect, it } from "vitest";

import { cell } from "./database-doc.mjs";

describe("cell", () => {
  it("escapes the backslash before the pipe, so a value cannot close the table cell", () => {
    expect(cell("a|b")).toBe("a\\|b");
    expect(cell("a\\|b")).toBe("a\\\\\\|b");
    expect(cell("plain")).toBe("plain");
  });
});
