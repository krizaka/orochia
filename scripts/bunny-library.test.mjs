import { describe, expect, it } from "vitest";

import { BRAND_ACCENT, bunnyLibraryApi, drift, fadeWatermark, libraryPatch, PLAYER_SETTINGS, plan, WATERMARK_BOX, WATERMARK_OPACITY } from "./bunny-library.mjs";

// The Stream library's look is code, not clicks: the payload below is exactly what is sent to Bunny, idempotent.
const bare = { Id: 1, Name: "orochia", PlayerKeyColor: "#ff7755", Controls: "play", HasWatermark: false };
const applied = { ...bare, ...PLAYER_SETTINGS };

describe("the library's player settings", () => {
  it("wear the Orochia accent (the @krizaka/tokens brand)", () => {
    expect(PLAYER_SETTINGS.PlayerKeyColor).toBe(BRAND_ACCENT);
    expect(BRAND_ACCENT).toBe("#7c3aed");
  });

  it("sends only what differs, and nothing the second time (idempotent)", () => {
    const first = plan(bare).patch;
    expect(first.PlayerKeyColor).toBe("#7c3aed");
    expect(Object.keys(first).sort()).toEqual(Object.keys(PLAYER_SETTINGS).filter((k) => bare[k] !== PLAYER_SETTINGS[k]).sort());
    expect(plan(applied).patch).toEqual({});
    expect(drift(applied)).toEqual([]);
    expect(drift(bare).length).toBeGreaterThan(0);
  });

  it("never touches a field it does not own", () => {
    expect(Object.keys(plan(bare, "on").patch).every((k) => k in PLAYER_SETTINGS || k in WATERMARK_BOX)).toBe(true);
    expect(libraryPatch({ a: 1 }, { a: 1 })).toEqual({});
  });
});

describe("the burned-in watermark", () => {
  it("is left alone by default (a choice, never a side effect of the player look)", () => {
    expect(plan(bare)).toEqual({ patch: plan(bare).patch, uploadWatermark: false, deleteWatermark: false });
    expect(Object.keys(plan(bare).patch).some((k) => k.startsWith("Watermark"))).toBe(false);
  });

  it("on: uploads the mark once and places it top-left, small, clear of the controls (bottom) and the AI chip / rating (top right)", () => {
    const on = plan(bare, "on");
    expect(on.uploadWatermark).toBe(true);
    expect(on.patch).toMatchObject(WATERMARK_BOX);
    const { WatermarkPositionLeft: left, WatermarkPositionTop: top, WatermarkWidth: w, WatermarkHeight: h } = WATERMARK_BOX;
    // one box for 9:16 and 16:9: equal shares keep the mark the same size on both (Bunny fits it, never stretches: 7 % of the short side)
    expect(w).toBe(h);
    expect(w).toBeLessThanOrEqual(8);
    // the top-left corner, inset a little: never the bottom-right (the player's controls and full-screen button) nor the right half (the AI chip)
    expect(left).toBeGreaterThanOrEqual(2);
    expect(top).toBeGreaterThanOrEqual(2);
    expect(left + w).toBeLessThanOrEqual(15);
    expect(top + h).toBeLessThanOrEqual(15);
    expect(plan({ ...applied, HasWatermark: true, ...WATERMARK_BOX }, "on")).toEqual({ patch: {}, uploadWatermark: false, deleteWatermark: false });
  });

  it("on --refresh-image: uploads the (re-faded) image again even when the library already has one", () => {
    expect(plan({ ...applied, HasWatermark: true, ...WATERMARK_BOX }, "on", { refreshImage: true }).uploadWatermark).toBe(true);
  });

  it("fades the mark's own alpha (quiet, never opaque) and leaves its colours alone", async () => {
    const { default: sharp } = await import("sharp");
    const solid = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 120, g: 60, b: 200, alpha: 1 } } }).png().toBuffer();
    const faded = await fadeWatermark(solid, WATERMARK_OPACITY);
    const { data } = await sharp(faded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([120, 60, 200]);
    expect(Math.abs(data[3] / 255 - WATERMARK_OPACITY)).toBeLessThan(0.02);
    expect(WATERMARK_OPACITY).toBeLessThan(0.8);
    expect(WATERMARK_OPACITY).toBeGreaterThan(0.3);
  });

  it("off: removes it, only when there is one (reversible: new encodes only)", () => {
    expect(plan({ ...applied, HasWatermark: true }, "off").deleteWatermark).toBe(true);
    expect(plan(applied, "off").deleteWatermark).toBe(false);
  });
});

describe("the Bunny API calls", () => {
  const record = () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, method: init?.method ?? "GET", key: init?.headers?.AccessKey, type: init?.headers?.["Content-Type"] });
      return { ok: true, json: async () => ({}) };
    };
    return { calls, api: bunnyLibraryApi(773325, "secret", fetchImpl) };
  };

  it("reads, updates, uploads and deletes the watermark on the library's own routes with the account key", async () => {
    const { calls, api } = record();
    await api.get();
    await api.update({ PlayerKeyColor: "#7c3aed" });
    await api.uploadWatermark(Buffer.from("png"));
    await api.deleteWatermark();
    expect(calls.map((c) => `${c.method} ${c.url.replace("https://api.bunny.net", "")}`)).toEqual([
      "GET /videolibrary/773325",
      "POST /videolibrary/773325",
      "PUT /videolibrary/773325/watermark",
      "DELETE /videolibrary/773325/watermark",
    ]);
    expect(calls.every((c) => c.key === "secret")).toBe(true);
    expect(calls[1].type).toBe("application/json");
  });

  it("fails loudly on a refusal", async () => {
    const api = bunnyLibraryApi(1, "k", async () => ({ ok: false, status: 401 }));
    await expect(api.get()).rejects.toThrow(/401/);
  });
});
