import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";

// Oussama: the loading of a video never shows « checking authorisation » (nor any sentence): the poster under a quiet
// Krizaka spinner, the signed URL signed on the server with the page. The real errors keep clear copy.
const read = (file: string) => readFileSync(join(__dirname, "..", file), "utf8");
const player = read("components/VideoPlayer.tsx");
const watch = read("app/[locale]/watch/[id]/WatchClient.tsx");
const page = read("app/[locale]/watch/[id]/page.tsx");

/** The source of one exported function, up to the next top-level declaration. */
function bodyOf(name: string) {
  const start = player.indexOf(`export function ${name}`);
  expect(start).toBeGreaterThan(-1);
  const end = player.indexOf("\n}\n", start);
  return player.slice(start, end);
}

describe("a video loading", () => {
  it("shows no text: the loading state is the poster and a spinner, with no message lookup", () => {
    const loading = bodyOf("PlayerLoading");
    expect(loading).toMatch(/<Spinner/);
    expect(loading).not.toMatch(/\bt\(/);
    expect(loading).not.toMatch(/>\s*[A-Za-z]{3,}[^<{]*</); // no literal text node
  });

  it("has no « authoriz/authoris/access check » sentence left in the watch or player messages", () => {
    const words = /authori[sz]|checking (your )?access|autoris|vérification de votre accès/i;
    for (const catalogue of [en, fr]) {
      const text = JSON.stringify({ watch: (catalogue as Record<string, unknown>).watch, player: (catalogue as Record<string, unknown>).player });
      expect(text).not.toMatch(words);
    }
    expect(watch).not.toMatch(/watch\.verifying/);
    expect(watch).not.toMatch(/authori[sz]/i);
  });

  it("covers the player's own wait too: a spinner until the first frame and on a stall, never a sentence", () => {
    expect(player).toMatch(/data-testid="player-spinner"/);
    expect(player).toMatch(/onLoadedData=\{handleFirstFrame\}/);
    expect(player).toMatch(/onWaiting=/);
  });

  it("is signed on the server with the page, and the details are asked with the stream, not before it", () => {
    expect(page).toMatch(/resolveStreamAccess\(/);
    expect(page).toMatch(/initial=\{\{ stream/);
    expect(watch).toMatch(/initial\?\.stream \? Promise\.resolve\(\) : fetchStreamAccess\(\)/);
    // the stream request starts before the details are awaited (no waterfall)
    expect(watch.indexOf("const streaming")).toBeGreaterThan(-1);
    expect(watch.indexOf("const streaming")).toBeLessThan(watch.indexOf("await streaming"));
    expect(watch.indexOf("await streaming")).toBeGreaterThan(watch.indexOf("const data = (await res.json())"));
  });

  it("keeps the real error states with clear copy: a failure offers a retry, a refusal keeps its gate", () => {
    expect(watch).toMatch(/<PlayerError/);
    expect(player).toMatch(/MAX_FATAL_ERRORS/);
    for (const catalogue of [en, fr]) {
      const p = (catalogue as unknown as { player: Record<string, string> }).player;
      expect(p.errorTitle.length).toBeGreaterThan(5);
      expect(p.errorBody.length).toBeGreaterThan(10);
      expect(p.retry.length).toBeGreaterThan(2);
      expect(p.paidCta).toBeTruthy();
    }
    expect(watch).toMatch(/GATE_REASONS/);
  });
});

describe("the Orochia watermark", () => {
  it("is the mark of @krizaka/ui, low opacity, scaled with the player, top-left (orochia#349: never beside the controls)", () => {
    expect(player).toMatch(/<OrochiaLogo[^>]*animated=\{false\}/);
    expect(player).toMatch(/data-testid="player-watermark"/);
    expect(player).toMatch(/left-\[3cqw\]/);
    expect(player).toMatch(/top-\[3cqw\]/);
    expect(player).toMatch(/opacity-50/);
    expect(player).toMatch(/size-\[clamp\(/);
    expect(player).not.toMatch(/bottom-\[clamp\(5rem/);
    expect(player).toMatch(/pointer-events-none/);
  });

  it("is hidden in full screen, over a gate and on a video that already carries the burned-in one", () => {
    expect(player).toMatch(/!isPaywalled && !isGated && !fullscreen && !burnedWatermark && \(\s*<span\s+aria-hidden\s+data-testid="player-watermark"/);
  });
});
