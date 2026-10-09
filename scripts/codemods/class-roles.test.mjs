import { describe, expect, it } from "vitest";

import { rewriteClasses } from "./class-roles.mjs";

// The table of study §2.12 ("Codemods"), pinned.
describe("rewriteClasses", () => {
  it.each([
    ["bg-zinc-950/70 light:bg-white", "bg-surface-1/70"],
    ["bg-zinc-900/60 light:bg-slate-50", "bg-surface-2/60"],
    ["text-white light:text-slate-900", "text-fg"],
    ["text-zinc-400 light:text-slate-500", "text-fg-secondary"],
    ["text-zinc-500 light:text-slate-500", "text-fg-muted"],
    ["border-white/10 light:border-black/5", "border-border-default"],
    ["border-white/5 light:border-black/5", "border-border-subtle"],
    ["bg-black/60 text-white backdrop-blur-md", "bg-scrim text-fg-on-media backdrop-blur-md"],
    ["hover:border-fuchsia-500/50 focus-visible:ring-violet-400 text-violet-400", "hover:border-accent/50 focus-visible:ring-ring text-accent"],
    ["from-violet-600 via-fuchsia-600 to-pink-600", "from-accent via-accent-2 to-accent-2"],
    ["bg-emerald-600/90 text-white", "bg-success/90 text-white"],
    ["text-rose-300", "text-danger"],
    ["text-amber-400", "text-warning"],
  ])("%s → %s", (from, to) => {
    expect(rewriteClasses(from)).toBe(to);
  });

  it("drops the light: and dark: twins of a converted colour, whatever the variant order", () => {
    expect(rewriteClasses("text-zinc-400 dark:text-zinc-400 light:text-slate-500 hover:text-white hover:light:text-slate-950")).toBe(
      "text-fg-secondary hover:text-fg",
    );
  });

  it("leaves a neutral colour alone when nothing proves it follows the theme (white text on a video)", () => {
    expect(rewriteClasses("text-white drop-shadow")).toBe("text-white drop-shadow");
    expect(rewriteClasses("bg-zinc-900")).toBe("bg-zinc-900");
  });

  it("keeps the whitespace at both ends (template literal pieces) and the important flag", () => {
    expect(rewriteClasses(" border-fuchsia-500/40! text-fuchsia-400! ")).toBe(" border-accent/40! text-accent! ");
  });

  it("keeps opacity, arbitrary opacity included, and maps the hover of a solid accent to accent-hover", () => {
    expect(rewriteClasses("bg-fuchsia-500/[0.05] bg-violet-600 hover:bg-violet-500")).toBe("bg-accent/[0.05] bg-accent hover:bg-accent-hover");
  });

  it("turns a near-black tint into a faint wash of the role", () => {
    expect(rewriteClasses("bg-red-950/30 from-violet-950/60 to-fuchsia-950")).toBe("bg-danger/10 from-accent/20 to-accent-2/15");
  });

  it("does not touch strings that hold no colour", () => {
    expect(rewriteClasses("flex items-center gap-2")).toBe("flex items-center gap-2");
    expect(rewriteClasses("Send a tip")).toBe("Send a tip");
  });
});
