import { describe, expect, it } from "vitest";
import { footerSpot, lyricBox, lyricText } from "./lyricLayout";

const area = { x: 10, y: 10, w: 80, h: 80 };

describe("lyricBox", () => {
  it("keeps the margin clear around centred words", () => {
    expect(lyricBox({ position: "middle", margin: 5, text_area: area }, 1920, 1080)).toEqual({
      left: 96,
      top: 54,
      width: 1728,
      height: 972,
      align: "center",
    });
  });

  it("puts lower-third words in the bottom third", () => {
    const box = lyricBox({ position: "bottom", margin: 0, text_area: area }, 1920, 1080);
    expect(box).toMatchObject({ top: 720, height: 360, align: "end" });
    expect(lyricBox({ position: "top", margin: 10, text_area: area }, 1920, 1080)).toMatchObject({ top: 108, height: 252, align: "start" });
  });

  it("clamps silly margins", () => {
    expect(lyricBox({ position: "middle", margin: 90, text_area: area }, 1000, 1000).width).toBe(600);
  });
});

describe("lyricText", () => {
  it("can shout", () => {
    expect(lyricText("Amazing grace", { uppercase: true })).toBe("AMAZING GRACE");
    expect(lyricText("Amazing grace", { uppercase: false })).toBe("Amazing grace");
  });
});

describe("custom placement", () => {
  it("puts the words where the box was dragged", () => {
    expect(lyricBox({ position: "custom", margin: 5, text_area: { x: 50, y: 25, w: 50, h: 50 } }, 1920, 1080)).toEqual({
      left: 960,
      top: 270,
      width: 960,
      height: 540,
      align: "center",
    });
  });

  const footer = { footer_place: "centre" as const, footer_x: 20, footer_y: 30, position: "middle" as const };

  it("places the copyright line from a preset or where it was dragged", () => {
    expect(footerSpot(footer)).toEqual({ x: 50, y: 96.7, align: "center", centred: true });
    expect(footerSpot({ ...footer, footer_place: "top_left" })).toMatchObject({ x: 2.5, align: "left", centred: false });
    expect(footerSpot({ ...footer, footer_place: "custom" })).toMatchObject({ x: 20, y: 30, align: "left" });
  });

  it("moves a bottom preset to the top above lower-third words, but not a dragged one", () => {
    expect(footerSpot({ ...footer, position: "bottom" }).y).toBeCloseTo(3.3);
    expect(footerSpot({ ...footer, footer_place: "custom", footer_y: 90, position: "bottom" }).y).toBe(90);
  });
});
