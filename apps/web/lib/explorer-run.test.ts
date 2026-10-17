import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { EXPLORER_DIMENSIONS } from "@orochia/db";

/** The recorded run (scripts/record-explorer-run.mjs): the proof krizaka.com reads to say that the Explorer runs on Orazaka. */
describe("explorer-run.json — a real run, recorded from Orazaka's own log", () => {
  const run = JSON.parse(readFileSync(new URL("./explorer-run.json", import.meta.url), "utf8"));

  it("carries a run id, the model and the counts Orazaka logged", () => {
    expect(run.runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(run.model).toBeTruthy();
    expect(run.inputs).toBeGreaterThan(0);
    expect(run.loggedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it("is of the size the index stores (a model of another size is a migration, not a record)", () => {
    expect(run.dimensions).toBe(EXPLORER_DIMENSIONS);
  });
});
