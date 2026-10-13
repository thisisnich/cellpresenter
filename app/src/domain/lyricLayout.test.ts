import { describe, expect, it } from "vitest";
import { lyricBox, lyricText } from "./lyricLayout";

describe("lyricBox", () => {
  it("keeps the margin clear around centred words", () => {
    expect(lyricBox({ position: "middle", margin: 5 }, 1920, 1080)).toEqual({
      left: 96,
      top: 54,
      width: 1728,
      height: 972,
      align: "center",
    });
  });

  it("puts lower-third words in the bottom third", () => {
    const box = lyricBox({ position: "bottom", margin: 0 }, 1920, 1080);
    expect(box).toMatchObject({ top: 720, height: 360, align: "end" });
    expect(lyricBox({ position: "top", margin: 10 }, 1920, 1080)).toMatchObject({ top: 108, height: 252, align: "start" });
  });

  it("clamps silly margins", () => {
    expect(lyricBox({ position: "middle", margin: 90 }, 1000, 1000).width).toBe(600);
  });
});

describe("lyricText", () => {
  it("can shout", () => {
    expect(lyricText("Amazing grace", { uppercase: true })).toBe("AMAZING GRACE");
    expect(lyricText("Amazing grace", { uppercase: false })).toBe("Amazing grace");
  });
});
