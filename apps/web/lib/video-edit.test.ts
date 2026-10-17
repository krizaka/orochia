import { describe, expect, it } from "vitest";
import { buildArgs } from "./video-edit";
import { DEFAULT_EDIT, parseStoredEdit, type VideoEdit } from "./video-edit-settings";

const edit = (over: Partial<VideoEdit> = {}): VideoEdit => ({ ...DEFAULT_EDIT, startSeconds: 2, endSeconds: 12, ...over });
const arg = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe("video editor export", () => {
  it("seeks to the start and keeps the selected length", () => {
    const args = buildArgs(edit(), "input.mp4", null, true);
    expect(arg(args, "-ss")).toBe("2.00");
    expect(arg(args, "-t")).toBe("10.00");
    expect(arg(args, "-map")).toBe("[v]");
  });

  it("speeds up picture and sound together and shortens the output", () => {
    const args = buildArgs(edit({ speed: 2 }), "input.mp4", null, true);
    const graph = arg(args, "-filter_complex");
    expect(graph).toContain("setpts=PTS/2");
    expect(graph).toContain("atempo=2");
    expect(arg(args, "-t")).toBe("5.00");
  });

  it("crops to 9:16 around the chosen focus", () => {
    const graph = arg(buildArgs(edit({ format: "vertical", focusX: 0.25 }), "input.mp4", null, true), "-filter_complex");
    expect(graph).toContain("crop='min(iw,ih*9/16)'");
    expect(graph).toContain("(in_w-out_w)*0.250");
  });

  it("drops the sound when muted and there is no music", () => {
    const args = buildArgs(edit({ volume: 0 }), "input.mp4", null, true);
    expect(args).toContain("-an");
    expect(arg(args, "-filter_complex")).not.toContain("[0:a]");
  });

  it("never reads a sound track the file does not have", () => {
    const args = buildArgs(edit(), "input.mp4", null, false);
    expect(arg(args, "-filter_complex")).not.toContain("[0:a]");
    expect(args).toContain("-an");
  });

  it("mixes looped music under the original sound, with fades on the mix", () => {
    const args = buildArgs(edit({ fadeIn: true, fadeOut: true, musicVolume: 0.4, denoise: true }), "input.mp4", "music.mp3", true);
    const graph = arg(args, "-filter_complex");
    expect(args.slice(args.indexOf("-stream_loop"), args.indexOf("-stream_loop") + 4)).toEqual(["-stream_loop", "-1", "-i", "music.mp3"]);
    expect(graph).toContain("afftdn");
    expect(graph).toContain("volume=0.40");
    expect(graph).toMatch(/amix=inputs=2:duration=first:normalize=0,afade=t=in.*afade=t=out:st=9\.00/);
    expect(args).toContain("[a]");
  });

  it("uses the music alone when the original sound is muted", () => {
    const args = buildArgs(edit({ volume: 0 }), "input.mp4", "music.mp3", true);
    const graph = arg(args, "-filter_complex");
    expect(graph).not.toContain("[0:a]");
    expect(graph).toContain("[m]anull[a]");
  });
});

describe("stored edit settings", () => {
  const valid = { ...DEFAULT_EDIT, music: undefined, startSeconds: 0, endSeconds: 5 };

  it("accepts what the editor produces", () => {
    expect(parseStoredEdit(valid)).toMatchObject({ endSeconds: 5, format: "original" });
  });

  it("refuses anything the editor cannot make", () => {
    expect(parseStoredEdit({ ...valid, speed: 3 })).toBeNull();
    expect(parseStoredEdit({ ...valid, filter: "evil" })).toBeNull();
    expect(parseStoredEdit({ ...valid, volume: 9 })).toBeNull();
    expect(parseStoredEdit({ ...valid, endSeconds: 0 })).toBeNull();
    expect(parseStoredEdit({ ...valid, fadeIn: "yes" })).toBeNull();
    expect(parseStoredEdit(null)).toBeNull();
  });

  it("keeps only known fields", () => {
    expect(parseStoredEdit({ ...valid, extra: "<script>" })).not.toHaveProperty("extra");
  });
});
