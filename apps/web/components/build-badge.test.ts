import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BuildBadge } from "@/components/BuildBadge";
import { buildUrl, describeBuild, parseAppEnv, showsBuildBadge } from "@/lib/build-info";

const render = (raw: { version?: string; env?: string; sha?: string }) =>
  renderToStaticMarkup(createElement(BuildBadge, { info: describeBuild(raw) }));

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

  it("is hidden in production only", () => {
    expect(showsBuildBadge(describeBuild({ env: "production" }))).toBe(false);
    for (const env of ["dev", "staging", "local", undefined]) expect(showsBuildBadge(describeBuild({ env }))).toBe(true);
  });
});

describe("BuildBadge", () => {
  it("renders nothing in production", () => {
    expect(render({ version: "1.0.0", env: "production", sha: "a1b2c3d" })).toBe("");
  });

  it("shows version, environment and commit on dev", () => {
    const html = render({ version: "1.0.0", env: "dev", sha: "a1b2c3d" });
    expect(html).toContain("v1.0.0 · dev · a1b2c3d");
    expect(html).toContain('href="https://github.com/krizaka/orochia/commit/a1b2c3d"');
    expect(html).toContain("not production-ready");
  });

  it("shows local when no environment is set, without a commit when unknown", () => {
    const html = render({ version: "1.0.0" });
    expect(html).toContain("v1.0.0 · local");
    expect(html).not.toContain("/commit/");
  });
});
