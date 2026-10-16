import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dockerfile = readFileSync(new URL("../deploy/docker/Dockerfile", import.meta.url), "utf8");

// dev deploys failed for two commits: @ast-grep/cli's postinstall finds no linux-musl binary on node:alpine.
describe("the image build", () => {
  it("installs without running install scripts (a lint tool's postinstall must not break the deploy)", () => {
    expect(dockerfile).toMatch(/^RUN npm ci --ignore-scripts$/m);
    expect(dockerfile).not.toMatch(/^RUN npm ci$/m);
  });
});
