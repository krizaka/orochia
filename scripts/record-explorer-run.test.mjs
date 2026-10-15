import { describe, expect, it } from "vitest";

import { parseRunLine } from "./record-explorer-run.mjs";

const ID = "f9b8f811-d15d-457e-8fbf-25c9be23772e";
const line = (id) =>
  `core 2026-10-15T01:57:12.726Z [conversation] {"@timestamp":"2026-10-15T01:57:12.726201974Z","log":{"level":"INFO"},"message":"embedding.run runId=${id} user=b12c6a1d model=gte-large-en-v1.5 inputs=8 dimensions=1024 promptTokens=222"}`;

describe("parseRunLine — what Orazaka's log says about a run", () => {
  it("reads the run's model, counts and time from its embedding.run line", () => {
    expect(parseRunLine(line(ID), ID)).toEqual({ runId: ID, model: "gte-large-en-v1.5", inputs: 8, dimensions: 1024, promptTokens: 222, loggedAt: "2026-10-15T01:57:12.726201974Z" });
  });

  it("is null for another run, for a failed run (no model) and for any other line", () => {
    expect(parseRunLine(line("00000000-0000-0000-0000-000000000000"), ID)).toBeNull();
    expect(parseRunLine(`{"message":"embedding.run runId=${ID} status=unavailable"}`, ID)).toBeNull();
    expect(parseRunLine('{"message":"something else"}', ID)).toBeNull();
  });
});
