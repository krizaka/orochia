import { describe, expect, it } from "vitest";

import { AiProvenanceSchema, CreateUploadSessionSchema } from "./types";

const base = { title: "A drone glide", visibility: "PUBLIC" as const, sizeBytes: 1024 };

describe("ai_provenance (orochia#268): the upload says how an AI clip was made, as data", () => {
  const provenance = { generator: "orazaka", runId: "ebb70c88-1111-4222-8333-444455556666", model: "Wan 2.2 A14B", hardware: "NVIDIA H100 80GB HBM3" };

  it("is accepted with a run id, a model and a hardware", () => {
    expect(AiProvenanceSchema.parse(provenance)).toMatchObject({ generator: "orazaka", runId: provenance.runId });
    expect(CreateUploadSessionSchema.parse({ ...base, aiProvenance: provenance }).aiProvenance?.model).toBe("Wan 2.2 A14B");
  });

  it("is optional: a human upload carries none", () => {
    expect(CreateUploadSessionSchema.parse(base).aiProvenance).toBeUndefined();
  });

  it("refuses a generator other than Orazaka, an empty run id and unknown fields", () => {
    expect(AiProvenanceSchema.safeParse({ ...provenance, generator: "someone" }).success).toBe(false);
    expect(AiProvenanceSchema.safeParse({ ...provenance, runId: "" }).success).toBe(false);
    expect(AiProvenanceSchema.safeParse({ ...provenance, extra: 1 }).success).toBe(false);
  });

  it("keeps the strings short (it is shown in a popover, not a place for prose)", () => {
    expect(AiProvenanceSchema.safeParse({ ...provenance, model: "x".repeat(200) }).success).toBe(false);
  });
});
