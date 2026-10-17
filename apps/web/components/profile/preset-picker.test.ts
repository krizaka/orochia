import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { htmlIn } from "@/lib/i18n-test-utils";
import { DEFAULT_AVATARS, DEFAULT_BANNERS } from "@/lib/presets";
import { PresetPicker } from "./PresetPicker";

const render = (props: Partial<Parameters<typeof PresetPicker>[0]> & { kind: "avatar" | "banner" }) =>
  htmlIn("en", createElement(PresetPicker, { presets: props.kind === "avatar" ? DEFAULT_AVATARS : DEFAULT_BANNERS, loading: false, selectedId: null, onPick: () => {}, ...props }));

describe("the preset picker", () => {
  it("shows the families as chips, 'All' first, and the pictures of the active family", () => {
    const html = render({ kind: "banner" });
    expect(html).toContain("All");
    expect(html).toContain("Abstract");
    expect(html).toContain("Places");
    expect(html).toContain("Textures");
  });
  it("lazy-loads every picture and gives it its alt text", () => {
    const html = render({ kind: "avatar" });
    expect((html.match(/<img /g) ?? []).length).toBe(DEFAULT_AVATARS.length);
    expect((html.match(/loading="lazy"/g) ?? []).length).toBe(DEFAULT_AVATARS.length);
    expect(html).toContain(`alt="${DEFAULT_AVATARS[0].alt.en}"`);
  });
  it("describes each picture in French on a French page", () => {
    const html = htmlIn("fr", createElement(PresetPicker, { kind: "avatar", presets: DEFAULT_AVATARS, loading: false, selectedId: null, onPick: () => {} }));
    expect(html).toContain(`alt="${DEFAULT_AVATARS[0].alt.fr}"`);
  });
  it("shows skeletons, not pictures, while the list loads", () => {
    const html = render({ kind: "banner", loading: true, presets: [] });
    expect(html).not.toContain("<img ");
    expect(html).toContain('aria-busy="true"');
  });
  it("marks the current picture as selected", () => {
    const html = render({ kind: "banner", selectedId: DEFAULT_BANNERS[2].id });
    expect(html).toContain('aria-pressed="true"');
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
  });
});
