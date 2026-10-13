import { describe, expect, it } from "vitest";
import { arrangementRuns, joinWithNext, splitInTwo } from "./slideEdits";
import { parseSongText } from "./songText";

const asWritten = (text: string) => parseSongText(text, { linesPerSlide: 0 });
const slides = (text: string, section: string) =>
  asWritten(text).sections.find((s) => s.name === section)!.slides.map((s) => s.map((l) => l.text));

const SONG = "[Verse 1]\na\nb\n\nc\nd\ne\n\n[Chorus]\nx\ny\n\n[Verse 1]";

describe("as written", () => {
  it("splits only at blank lines", () => {
    expect(slides(SONG, "Verse 1")).toEqual([["a", "b"], ["c", "d", "e"]]);
    expect(parseSongText(SONG, { linesPerSlide: 2 }).sections[0].slides).toHaveLength(3);
  });
});

describe("joinWithNext", () => {
  it("joins a slide with the next in its section", () => {
    const text = joinWithNext(asWritten(SONG), "Verse 1", 0)!;
    expect(slides(text, "Verse 1")).toEqual([["a", "b", "c", "d", "e"]]);
    // The arrangement (Verse 1 played again) survives.
    expect(asWritten(text).arrangement).toEqual(["Verse 1", "Chorus", "Verse 1"]);
  });

  it("won't join past the section's last slide", () => {
    expect(joinWithNext(asWritten(SONG), "Verse 1", 1)).toBeNull();
    expect(joinWithNext(asWritten(SONG), "Bridge", 0)).toBeNull();
  });
});

describe("splitInTwo", () => {
  it("splits a slide at its middle", () => {
    const text = splitInTwo(asWritten(SONG), "Verse 1", 1)!;
    expect(slides(text, "Verse 1")).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });

  it("keeps chords with their lines", () => {
    const p = asWritten("[Verse]\nG\nline one\nC\nline two");
    const text = splitInTwo(p, "Verse", 0)!;
    const after = asWritten(text).sections[0].slides;
    expect(after.map((s) => s[0].chords.map((c) => c.chord))).toEqual([["G"], ["C"]]);
  });

  it("won't split a one-line slide", () => {
    expect(splitInTwo(asWritten("[V]\nonly"), "V", 0)).toBeNull();
  });
});

describe("arrangementRuns", () => {
  it("folds repeats", () => {
    expect(arrangementRuns(["Verse 1", "Chorus", "Bridge", "Bridge", "Bridge", "Chorus"])).toEqual([
      { name: "Verse 1", times: 1 },
      { name: "Chorus", times: 1 },
      { name: "Bridge", times: 3 },
      { name: "Chorus", times: 1 },
    ]);
  });
});
