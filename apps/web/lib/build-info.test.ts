import { describe, expect, it } from "vitest";

import { buildUrl, describeBuild, parseAppEnv } from "@/lib/build-info";

describe("build info", () => {
  it("reads the environment, local when unset or unknown", () => {
    expect(parseAppEnv("dev")).toBe("dev");
    expect(parseAppEnv(" Production ")).toBe("production");
    expect(parseAppEnv(undefined)).toBe("local");
    expect(parseAppEnv("qa")).toBe("local");
  });

  it("keeps a short, well-formed SHA only", () => {
    expect(describeBuild({ version: "1.2.3", env: "dev", sha: "A1B2C3D4E5F6" }).sha).toBe("a1b2c3d");
    expect(describeBuild({ sha: "" }).sha).toBeNull();
    expect(describeBuild({ sha: "not-a-sha" }).sha).toBeNull();
  });

  it("links the commit, or the repository without one", () => {
    expect(buildUrl(describeBuild({ sha: "a1b2c3d" }))).toBe("https://github.com/krizaka/orochia/commit/a1b2c3d");
    expect(buildUrl(describeBuild({}))).toBe("https://github.com/krizaka/orochia");
  });

});
