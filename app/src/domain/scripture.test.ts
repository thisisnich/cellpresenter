import { describe, expect, it } from "vitest";
import { findBook, parseReference, referenceText } from "./scripture";

const ok = (input: string) => {
  const r = parseReference(input);
  if (!r.ok) throw new Error(`${input}: ${r.reason}`);
  return r.passage;
};
const span = (fc: number, fv: number, tc: number, tv: number) => ({
  from: { chapter: fc, verse: fv },
  to: { chapter: tc, verse: tv },
});

describe("findBook", () => {
  it("knows names, abbreviations and numbered books", () => {
    expect(findBook("John")).toBe(43);
    expect(findBook("jn")).toBe(43);
    expect(findBook("Jhn.")).toBe(43);
    expect(findBook("1 Cor")).toBe(46);
    expect(findBook("1cor")).toBe(46);
    expect(findBook("II Timothy")).toBe(55);
    expect(findBook("First John")).toBe(62);
    expect(findBook("Ps")).toBe(19);
    expect(findBook("Psalm")).toBe(19);
    expect(findBook("Song of Solomon")).toBe(22);
    expect(findBook("Phil")).toBe(50);
    expect(findBook("Philem")).toBe(57);
    expect(findBook("Rev")).toBe(66);
    expect(findBook("Gen")).toBe(1);
  });

  it("won't guess between books", () => {
    expect(findBook("J")).toBeNull();
    expect(findBook("Hezekiah")).toBeNull();
  });
});

describe("parseReference", () => {
  it("reads verses, ranges and lists", () => {
    expect(ok("John 3:16")).toEqual({ book: 43, ranges: [span(3, 16, 3, 16)] });
    expect(ok("Jn 3:16-18")).toEqual({ book: 43, ranges: [span(3, 16, 3, 18)] });
    expect(ok("Ps 23:1–4, 6")).toEqual({ book: 19, ranges: [span(23, 1, 23, 4), span(23, 6, 23, 6)] });
    expect(ok("Ruth 1:16-2:3")).toEqual({ book: 8, ranges: [span(1, 16, 2, 3)] });
    expect(ok("Rom 8:28; 12:1-2")).toEqual({ book: 45, ranges: [span(8, 28, 8, 28), span(12, 1, 12, 2)] });
    expect(ok("John 3.16")).toEqual({ book: 43, ranges: [span(3, 16, 3, 16)] });
  });

  it("reads whole chapters", () => {
    expect(ok("1 Cor 13")).toEqual({ book: 46, ranges: [span(13, 1, 13, 0)] });
    expect(ok("Psalm 1-2")).toEqual({ book: 19, ranges: [span(1, 1, 2, 0)] });
    expect(ok("Genesis")).toEqual({ book: 1, ranges: [span(1, 1, 1, 0)] });
  });

  it("treats numbers in one-chapter books as verses", () => {
    expect(ok("Jude 3")).toEqual({ book: 65, ranges: [span(1, 3, 1, 3)] });
    expect(ok("Philemon 4-7")).toEqual({ book: 57, ranges: [span(1, 4, 1, 7)] });
  });

  it("says what's wrong", () => {
    expect(parseReference("Hezekiah 3:16")).toEqual({ ok: false, reason: "book" });
    expect(parseReference("John 3:18-16")).toEqual({ ok: false, reason: "numbers" });
    expect(parseReference("John 3:x")).toEqual({ ok: false, reason: "book" });
  });
});

describe("referenceText", () => {
  it("writes a reference back out", () => {
    expect(referenceText(43, 3)).toBe("John 3");
    expect(referenceText(43, 3, 18, 16)).toBe("John 3:16-18");
    expect(referenceText(43, 3, 16, 16)).toBe("John 3:16");
  });
});
