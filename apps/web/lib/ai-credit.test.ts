import { describe, expect, it } from "vitest";

import { aiCreditOf, parseAiCredit } from "./ai-credit";

const RUN = "ebb70c88-1111-4222-8333-444455556666";

describe("the AI credit (orochia#268): the structured field first, the old description line as a fallback", () => {
  it("reads the provenance field", () => {
    const credit = aiCreditOf({ aiProvenance: { generator: "orazaka", runId: RUN, model: "Wan 2.2 A14B", hardware: "H100" }, description: "A drone glide." });
    expect(credit).toMatchObject({ runId: RUN, model: "Wan 2.2 A14B", hardware: "H100" });
    expect(credit?.line).toContain("Made with Orazaka");
  });

  it("prefers the field over what the description says", () => {
    const credit = aiCreditOf({ aiProvenance: { generator: "orazaka", runId: RUN, model: "A" }, description: "Made with Orazaka — run abcdef12 (B on C)." });
    expect(credit?.model).toBe("A");
    expect(credit?.runId).toBe(RUN);
  });

  it("falls back to the description line for videos made before the field existed", () => {
    expect(aiCreditOf({ aiProvenance: null, description: "x\n\nMade with Orazaka — run abcdef12 (Wan 2.2 on H100)." })).toEqual(parseAiCredit("Made with Orazaka — run abcdef12 (Wan 2.2 on H100)."));
  });

  it("is null for a human video", () => {
    expect(aiCreditOf({ aiProvenance: null, description: "My morning run." })).toBeNull();
    expect(aiCreditOf({})).toBeNull();
  });
});
