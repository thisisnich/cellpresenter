import { describe, expect, it } from "vitest";
import {
  capoShapeKey,
  keyName,
  keyUsesFlats,
  parseChord,
  parseKey,
  semitonesBetween,
  transposeChord,
  transposeChordLine,
  transposeKey,
} from "./chords";

const key = (name: string) => {
  const k = parseKey(name);
  if (!k) throw new Error(`bad key ${name}`);
  return k;
};

describe("parseChord", () => {
  it("reads root, quality and slash bass", () => {
    expect(parseChord("Em7")).toEqual({ root: 4, quality: "m7", bass: undefined });
    expect(parseChord("D/F#")).toEqual({ root: 2, quality: "", bass: 6 });
    expect(parseChord("Bbsus4")).toEqual({ root: 10, quality: "sus4", bass: undefined });
  });

  it("rejects lyric words and junk", () => {
    expect(parseChord("Amazing")).toBeNull();
    expect(parseChord("Be")).toBeNull();
    expect(parseChord("H")).toBeNull();
    expect(parseChord("")).toBeNull();
  });
});

describe("transposeChord", () => {
  it("moves root and bass together", () => {
    expect(transposeChord("D/F#", 2, false)).toBe("E/G#");
    expect(transposeChord("G7", 5, false)).toBe("C7");
  });

  it("spells with flats or sharps as asked", () => {
    expect(transposeChord("C", 3, true)).toBe("Eb");
    expect(transposeChord("C", 3, false)).toBe("D#");
  });

  it("wraps around the octave in both directions", () => {
    expect(transposeChord("B", 1, false)).toBe("C");
    expect(transposeChord("C", -1, false)).toBe("B");
  });

  it("leaves non-chords alone", () => {
    expect(transposeChord("N.C.", 2, false)).toBe("N.C.");
  });
});

describe("transposeChordLine", () => {
  it("keeps spacing between chords", () => {
    expect(transposeChordLine("G   D/F#  Em7", 2, false)).toBe("A   E/G#  F#m7");
  });
});

describe("keys", () => {
  it("parses and names keys conventionally", () => {
    expect(keyName(key("Gb"))).toBe("F#");
    expect(keyName(key("A#"))).toBe("Bb");
    expect(keyName(key("C#m"))).toBe("C#m");
    expect(keyName(key("Ebm"))).toBe("Ebm");
  });

  it("knows which keys use flats", () => {
    expect(keyUsesFlats(key("F"))).toBe(true);
    expect(keyUsesFlats(key("G"))).toBe(false);
    expect(keyUsesFlats(key("C"))).toBe(false);
    expect(keyUsesFlats(key("Dm"))).toBe(true);
    expect(keyUsesFlats(key("Em"))).toBe(false);
  });

  it("transposes keys and measures the distance", () => {
    expect(keyName(transposeKey(key("C"), 2))).toBe("D");
    expect(semitonesBetween(key("G"), key("C"))).toBe(5);
    expect(semitonesBetween(key("C"), key("G"))).toBe(7);
  });

  it("finds capo shape keys", () => {
    expect(keyName(capoShapeKey(key("Eb"), 3))).toBe("C");
    expect(keyName(capoShapeKey(key("A"), 2))).toBe("G");
  });
});

describe("chord qualities", () => {
  it("accepts common extended chords", () => {
    for (const c of ["Cmaj7", "Am7b5", "Dsus4", "Gadd9", "Bdim7", "E7sus4", "F#m11", "C2", "Bb(add9)"]) {
      expect(parseChord(c), c).not.toBeNull();
    }
  });
});
