import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEFAULT_AVATARS, DEFAULT_BANNERS } from "@/lib/presets";
import { PresetPicker } from "./PresetPicker";

const render = (props: Partial<Parameters<typeof PresetPicker>[0]> & { kind: "avatar" | "banner" }) =>
  renderToStaticMarkup(createElement(PresetPicker, { presets: props.kind === "avatar" ? DEFAULT_AVATARS : DEFAULT_BANNERS, loading: false, selectedId: null, onPick: () => {}, ...props }));

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
