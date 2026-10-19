import React from "react";
import { describe, expect, it } from "vitest";

import { htmlIn } from "@/lib/i18n-test-utils";

import { Clip } from "./Clip";

// ORO-PERF: /how-it-works loaded twelve posters at once (≈ 0.9 MB) and the hero's poster waited for them (LCP 6.7 s on a
// throttled phone). The hero's poster is preloaded at high priority; every other clip's poster is a lazy picture.
const render = (props: { priority?: boolean }) => htmlIn("en", React.createElement(Clip, { clip: "showcase", locale: "en", label: "A day on Orochia", frameLabel: "orochia · web", ...props }));

describe("a recording of the app on /how-it-works", () => {
  it("the hero's clip keeps its poster on the video and preloads it at high priority", () => {
    const html = render({ priority: true });
    expect(html).toMatch(/<video[^>]*poster="https:[^"]*showcase[^"]*"/);
    expect(html).toMatch(/<link rel="preload" as="image" href="[^"]*showcase[^"]*" fetchPriority="high"/);
  });

  it("a clip below the fold shows its poster as a lazy picture, and the video carries none", () => {
    const html = render({});
    expect(html).toMatch(/<img[^>]*src="https:[^"]*showcase[^"]*"[^>]*loading="lazy"/);
    expect(html).not.toMatch(/<video[^>]*poster=/);
    expect(html).not.toContain('rel="preload"');
  });

  it("still plays on demand: controls, no autoplay, nothing fetched before the press", () => {
    for (const priority of [true, false]) {
      const html = render({ priority });
      expect(html).toContain("controls");
      expect(html).toContain('preload="none"');
      expect(html).not.toContain("autoplay");
    }
  });
});
