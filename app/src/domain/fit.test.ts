import { describe, expect, it } from "vitest";
import { fitFontSize } from "./fit";

// Pretend every character is half the font size wide.
const measure = (line: string, size: number) => line.length * size * 0.5;
const box = { size: 100, maxWidth: 1000, maxHeight: 800, lineHeight: 1.25 };

describe("fitFontSize", () => {
  it("keeps the base size when everything fits", () => {
    expect(fitFontSize(["short", "lines"], measure, box)).toBe(100);
  });

  it("shrinks so the widest line fits", () => {
    // 40 chars × 50 px = 2000 px wide at size 100 → half size.
    expect(fitFontSize(["x".repeat(40), "short"], measure, box)).toBe(50);
  });

  it("shrinks so all lines fit vertically", () => {
    // 8 lines × 125 px = 1000 px tall → 0.8.
    expect(fitFontSize(Array(8).fill("a"), measure, box)).toBeCloseTo(80);
  });

  it("handles an empty slide", () => {
    expect(fitFontSize([], measure, box)).toBe(100);
  });
});
