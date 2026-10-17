import { describe, expect, it } from "vitest";

import { uploadSteps } from "./upload-steps";

describe("uploadSteps", () => {
  it("sending: the first step is current and carries the progress, the rest wait", () => {
    expect(uploadSteps("uploading", 40)).toEqual([
      { id: "send", status: "current", value: 0.4 },
      { id: "encode", status: "upcoming" },
      { id: "live", status: "upcoming" },
    ]);
  });
  it("queued and paused count as sending, at the progress so far", () => {
    expect(uploadSteps("queued", 0)[0]).toMatchObject({ status: "current", value: 0 });
    expect(uploadSteps("paused", 75)[0]).toMatchObject({ status: "current", value: 0.75 });
  });
  it("sent: the file is done and the encoding is under way (nothing invented about its progress)", () => {
    const steps = uploadSteps("completed", 100);
    expect(steps.map((s) => s.status)).toEqual(["done", "current", "upcoming"]);
    expect(steps[1]).not.toHaveProperty("value");
  });
  it("a failed upload stops the journey on its first step", () => {
    expect(uploadSteps("error", 63).map((s) => s.status)).toEqual(["error", "upcoming", "upcoming"]);
  });
  it("keeps the progress between 0 and 1", () => {
    expect(uploadSteps("uploading", 140)[0]).toMatchObject({ value: 1 });
    expect(uploadSteps("uploading", -3)[0]).toMatchObject({ value: 0 });
    expect(uploadSteps(undefined, 0)[0]).toMatchObject({ status: "current" });
  });
});
