import { describe, expect, it } from "vitest";
import type { Song } from "../generated/Song";
import { chunksOf, hasChords, keyInfo, sheetOf } from "./chordSheet";

const line = (text: string, chords: [number, string][] = []) => ({
  text,
  chords: chords.map(([at, chord]) => ({ at, chord })),
});

const song: Song = {
  id: "s",
  title: "S",
  artist: null,
  key: "G",
  capo: 0,
  ccli_number: null,
  copyright: null,
  arrangement: ["v", "c", "v"],
  background_id: null,
  sections: [
    { id: "v", name: "Verse 1", slides: [{ id: "v1", lines: [line("Amazing grace", [[0, "G"], [8, "C"]])], background_id: null }] },
    { id: "c", name: "Chorus", slides: [{ id: "c1", lines: [line("no chords here")], background_id: null }] },
  ],
  updated_at: 0,
};

describe("chunksOf", () => {
  it("splits a line at each chord", () => {
    expect(chunksOf(line("Amazing grace", [[0, "G"], [8, "C"]]))).toEqual([
      { chord: "G", text: "Amazing " },
      { chord: "C", text: "grace" },
    ]);
  });

  it("keeps words before the first chord and chords past the end", () => {
    expect(chunksOf(line("It is well", [[6, "D"], [20, "G"]]))).toEqual([
      { chord: null, text: "It is " },
      { chord: "D", text: "well" },
      { chord: "G", text: "" },
    ]);
  });

  it("returns the plain line when there are no chords", () => {
    expect(chunksOf(line("plain"))).toEqual([{ chord: null, text: "plain" }]);
  });
});

describe("sheetOf", () => {
  it("follows the arrangement, so its slides line up with the live slides", () => {
    expect(sheetOf(song, { semitones: 0, capo: 0 }).map((s) => s.section)).toEqual(["Verse 1", "Chorus", "Verse 1"]);
  });

  it("transposes up and shows capo shapes", () => {
    const up2 = sheetOf(song, { semitones: 2, capo: 0 })[0].lines[0].chunks.map((c) => c.chord);
    expect(up2).toEqual(["A", "D"]);
    // Sounding in A with capo 2: play G shapes.
    const capo = sheetOf(song, { semitones: 2, capo: 2 })[0].lines[0].chunks.map((c) => c.chord);
    expect(capo).toEqual(["G", "C"]);
  });

  it("spells with flats in flat keys", () => {
    const toF = sheetOf(song, { semitones: -2, capo: 0 })[0].lines[0].chunks.map((c) => c.chord);
    expect(toF).toEqual(["F", "Bb"]);
  });
});

describe("keyInfo", () => {
  it("names the sounding key and the capo shapes", () => {
    expect(keyInfo("G", { semitones: 2, capo: 0 })).toEqual({ sounding: "A", shapes: null });
    expect(keyInfo("G", { semitones: 2, capo: 2 })).toEqual({ sounding: "A", shapes: "G" });
    expect(keyInfo(null, { semitones: 2, capo: 0 })).toEqual({ sounding: null, shapes: null });
  });
});

describe("hasChords", () => {
  it("knows whether a song carries chords", () => {
    expect(hasChords(song)).toBe(true);
  });
});
