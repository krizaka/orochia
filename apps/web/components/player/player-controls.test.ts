import { readFileSync } from "node:fs";
import { join } from "node:path";

import React from "react";
import { describe, expect, it } from "vitest";

import { htmlIn } from "@/lib/i18n-test-utils";
import { levelOptions } from "@/lib/player-quality";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { AiChip, aiChipVisible } from "./AiChip";
import { QualityMenu } from "./QualityMenu";

const read = (rel: string) => readFileSync(join(__dirname, rel), "utf8");
const player = read("../VideoPlayer.tsx");
const L = (width: number, height: number, bitrate = width * height) => ({ width, height, bitrate });
const OPTIONS = levelOptions([L(426, 240), L(854, 480), L(1280, 720), L(1920, 1080)]);
const menu = (locale: "en" | "fr", props: Partial<React.ComponentProps<typeof QualityMenu>> = {}) =>
  htmlIn(locale, React.createElement(QualityMenu, { options: OPTIONS, value: "auto", onSelect: () => {}, ...props }));

describe("the AI chip (the disclosure, in the Krizaka UI language)", () => {
  it("says « AI-generated » in English and « Généré par IA » in French, in the UI language, with an accessible name", () => {
    const en_ = htmlIn("en", React.createElement(AiChip, { visible: true }));
    expect(en_).toContain("AI-generated");
    expect(en_).toContain('data-testid="player-ai-chip"');
    expect(en_).toContain('aria-label="AI-generated video"');
    const fr_ = htmlIn("fr", React.createElement(AiChip, { visible: true }));
    expect(fr_).toContain("Généré par IA");
    expect(fr_).toContain("Vidéo générée par IA");
  });
  it("is a quiet chip of 8 px (rounded-sm in the 3.32 scale), not a pill, not shouting capitals", () => {
    const out = htmlIn("en", React.createElement(AiChip, { visible: true }));
    expect(out).toContain("rounded-sm");
    expect(out).not.toContain("rounded-full");
    expect(out).toContain("normal-case");
  });
  it("fades out (never leaves the accessibility tree) when it is not to be seen", () => {
    const hidden = htmlIn("en", React.createElement(AiChip, { visible: false }));
    expect(hidden).toContain("opacity-0");
    expect(hidden).toContain("AI-generated");
    const root = hidden.slice(0, hidden.indexOf(">") + 1); // the chip itself (its icon is decorative, rightly aria-hidden)
    expect(root).not.toMatch(/aria-hidden|\bhidden\b|invisible|display:\s*none/);
    expect(htmlIn("en", React.createElement(AiChip, { visible: true }))).toContain("opacity-100");
  });
  it("is visible at the start, on hover (controls shown) and when paused; it may rest only while playing, pointer away, past the first seconds", () => {
    expect(aiChipVisible({ isPlaying: false, showControls: false, currentTime: 0 })).toBe(true); // paused / not started
    expect(aiChipVisible({ isPlaying: true, showControls: true, currentTime: 60 })).toBe(true); // hover, or a finger
    expect(aiChipVisible({ isPlaying: true, showControls: false, currentTime: 2 })).toBe(true); // the start
    expect(aiChipVisible({ isPlaying: true, showControls: false, currentTime: 12 })).toBe(false);
  });
  it("has both messages, and the player wires it from the video's provenance", () => {
    for (const c of [en, fr]) {
      expect(c.player.ai.chip.length).toBeGreaterThan(0);
      expect(c.player.ai.label.length).toBeGreaterThan(0);
    }
    expect(player).toContain("<AiChip");
    expect(player).toMatch(/aiGenerated/);
  });
});

describe("the quality picker (levels → menu → switch)", () => {
  it("shows the current quality on its button, named for the player's language", () => {
    expect(menu("en")).toContain('aria-haspopup="menu"');
    expect(menu("en")).toContain('aria-label="Quality: Auto"');
    expect(menu("fr")).toContain('aria-label="Qualité\u00a0: Auto"');
    expect(menu("en", { value: "720" })).toContain('aria-label="Quality: 720p"');
  });
  it("lists Auto then every rendition as one radio item each, the chosen one checked", () => {
    const out = menu("en", { defaultOpen: true, value: "720" });
    expect(out).toContain('role="menu"');
    expect((out.match(/role="menuitemradio"/g) ?? []).length).toBe(OPTIONS.length);
    expect(out.indexOf(">Auto")).toBeLessThan(out.indexOf(">1080p"));
    expect(out.indexOf(">1080p")).toBeLessThan(out.indexOf(">240p"));
    expect(out).toMatch(/aria-checked="true"[^>]*data-quality="720"|data-quality="720"[^>]*aria-checked="true"/);
    expect((out.match(/aria-checked="true"/g) ?? []).length).toBe(1);
  });
  it("badges only the renditions of 1080 or more (HD on 1080p, nothing on 720p and below)", () => {
    const out = menu("en", { defaultOpen: true });
    expect((out.match(/data-testid="quality-badge"/g) ?? []).length).toBe(1);
    expect(out.indexOf("HD")).toBeGreaterThan(out.indexOf(">1080p"));
    expect(out.indexOf("HD")).toBeLessThan(out.indexOf(">720p"));
  });
  it("says what Auto is playing right now", () => {
    expect(menu("en", { defaultOpen: true, autoHeight: 480 })).toContain("Auto (480p)");
    expect(menu("fr", { defaultOpen: true, autoHeight: 480 })).toContain("Auto (480p)");
  });
  it("explains, rather than hides, what a device that picks by itself cannot do (iPhone Safari's native HLS without variants)", () => {
    const out = menu("en", { options: [], native: true, defaultOpen: true });
    expect(out).toContain("Your device picks the quality by itself.");
    expect(menu("fr", { options: [], native: true, defaultOpen: true })).toContain("Votre appareil choisit la qualité tout seul.");
    expect(menu("en", { options: [], native: false })).toBe(""); // nothing to pick and nothing to say before the stream is known
  });
  it("is keyboard accessible: roving focus, arrows, Escape, focus returned", () => {
    const src = read("QualityMenu.tsx");
    expect(src).toContain("menuKeyStep");
    expect(src).toContain('"Escape"');
    expect(src).toMatch(/tabIndex=\{/);
    expect(src).toContain("aria-expanded");
    expect(src).toContain("aria-controls");
    expect(src).not.toContain("onMouseEnter");
  });
  it("has its messages in English and French", () => {
    for (const c of [en, fr]) {
      for (const k of ["menu", "button", "auto", "autoNow", "native"] as const) expect(c.player.quality[k].length).toBeGreaterThan(0);
    }
  });
});

describe("the player's layout: the controls stay clear of the marks", () => {
  it("puts the Orochia mark top-left (never bottom-right) and the rating and the AI chip top-right", () => {
    const mark = player.slice(player.indexOf('data-testid="player-watermark"'), player.indexOf("</span>", player.indexOf('data-testid="player-watermark"')));
    expect(mark).toMatch(/left-\[/);
    expect(mark).toMatch(/top-\[/);
    expect(mark).not.toMatch(/\bbottom-|\bright-/);
    expect(player).toMatch(/absolute right-3 top-3[^"]*"[\s\S]{0,400}18\+/);
    expect(player).not.toContain("absolute top-4 left-4");
  });
  it("keeps the bottom bar for the controls only, quality next to full screen", () => {
    expect(player.indexOf("<QualityMenu")).toBeGreaterThan(player.indexOf("Custom Video Controls"));
    expect(player.indexOf("<QualityMenu")).toBeLessThan(player.indexOf("t(\"player.fullscreen\")"));
  });
  it("keeps the controls shown while the menu is open", () => {
    expect(player).toMatch(/showControls \|\| menuOpen/);
  });
  it("opens inside the player (no portal: a full-screen container hides anything outside it)", () => {
    expect(read("QualityMenu.tsx")).not.toMatch(/createPortal|DropdownMenu/);
  });
  it("restores the session's choice and switches on the media element's levels (hls.js) or the master's variants (native)", () => {
    expect(player).toContain("levelOptions(");
    expect(player).toContain("applyQuality(");
    expect(player).toContain("readStoredQuality(");
    expect(player).toContain("storeQuality(");
    expect(player).toContain("sessionStorage");
    expect(player).toContain("parseMasterPlaylist(");
  });
});
