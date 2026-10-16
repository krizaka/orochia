import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./PictureQuickEdit.tsx", import.meta.url), "utf8");
const messages = JSON.parse(readFileSync(new URL("../../messages/en.json", import.meta.url), "utf8")).settings.pictures;

// Seen live on @qa_creator: the camera menu offered only "Upload a photo" and the page's tabs painted over it.
describe("the camera menu of a profile picture", () => {
  it("is the kit's DropdownMenu (a portal above the page), not a box positioned by hand", () => {
    expect(source).toContain("DropdownMenu.Root");
    expect(source).toContain("DropdownMenu.Content");
    expect(source).not.toMatch(/role="menu"/);
    expect(source).not.toMatch(/absolute mt-2 w-56/);
  });
  it("offers choose, upload and remove — for the avatar and for the cover", () => {
    expect(source).toContain("settings.pictures.chooseAvatar");
    expect(source).toContain("settings.pictures.chooseBanner");
    expect(source).toContain("settings.pictures.upload");
    expect(source).toContain("settings.pictures.remove");
    expect(messages.chooseAvatar).toBe("Choose an avatar");
    expect(messages.chooseBanner).toBe("Choose a cover");
  });
  it("highlights the picture shown now in the picker and lists every default", () => {
    expect(source).toContain("aria-pressed={current === p.url}");
    expect(source).toContain("isAvatar ? 15 : 9");
  });
});
