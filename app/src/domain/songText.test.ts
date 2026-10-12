import { describe, expect, it } from "vitest";
import { chordLine, inlineChords, parseSongText, renderChordLine, sectionHeader, songToText } from "./songText";

const opts = { linesPerSlide: 2 };
const texts = (song: ReturnType<typeof parseSongText>, name: string) =>
  song.sections.find((s) => s.name === name)?.slides.map((slide) => slide.map((l) => l.text));

describe("sectionHeader", () => {
  it("recognises common header styles", () => {
    expect(sectionHeader("[Verse 1]")).toBe("Verse 1");
    expect(sectionHeader("VERSE 2:")).toBe("Verse 2");
    expect(sectionHeader("Chorus")).toBe("Chorus");
    expect(sectionHeader("pre chorus")).toBe("Pre-Chorus");
    expect(sectionHeader("[Tag x2]")).toBe("Tag");
    expect(sectionHeader("Bridge (x2)")).toBe("Bridge");
  });

  it("doesn't mistake lyrics or chords for headers", () => {
    expect(sectionHeader("[G]")).toBeNull();
    expect(sectionHeader("Chorus of angels sing")).toBeNull();
    expect(sectionHeader("Amazing grace")).toBeNull();
  });
});

describe("chord lines", () => {
  it("finds chords and their columns", () => {
    expect(chordLine("C       F    C")).toEqual([
      { at: 0, chord: "C" },
      { at: 8, chord: "F" },
      { at: 13, chord: "C" },
    ]);
    expect(chordLine("| G  D/F# | Em7 (C) |")).toHaveLength(4);
  });

  it("rejects lyric lines", () => {
    expect(chordLine("A mighty fortress is our God")).toBeNull();
    expect(chordLine("Am I a soldier")).toBeNull();
    expect(chordLine("")).toBeNull();
  });

  it("extracts inline chords", () => {
    expect(inlineChords("[C]Amazing [G]grace")).toEqual({
      text: "Amazing grace",
      chords: [
        { at: 0, chord: "C" },
        { at: 8, chord: "G" },
      ],
    });
  });

  it("lays chords out without overlapping", () => {
    expect(renderChordLine([{ at: 0, chord: "C" }, { at: 8, chord: "F" }])).toBe("C       F");
    expect(renderChordLine([{ at: 0, chord: "Cmaj7" }, { at: 2, chord: "G" }])).toBe("Cmaj7 G");
  });
});

describe("parseSongText", () => {
  it("reads a chord sheet with headers, slide breaks and a repeated chorus", () => {
    const song = parseSongText(
      `[Verse 1]
C                 F       C
When peace like a river attendeth my way
C            F         G
When sorrows like sea billows roll

Whatever my lot
It is well

[Chorus]
It is well with my soul

[Verse 2]
Though Satan should buffet

[Chorus]
`,
      opts,
    );
    expect(song.arrangement).toEqual(["Verse 1", "Chorus", "Verse 2", "Chorus"]);
    expect(texts(song, "Verse 1")).toEqual([
      ["When peace like a river attendeth my way", "When sorrows like sea billows roll"],
      ["Whatever my lot", "It is well"],
    ]);
    const firstLine = song.sections[0].slides[0][0];
    expect(firstLine.chords.map((c) => c.chord)).toEqual(["C", "F", "C"]);
    expect(firstLine.text.slice(firstLine.chords[1].at)).toMatch(/^river/);
  });

  it("splits long blocks by lines per slide", () => {
    const song = parseSongText("[Verse 1]\na\nb\nc\nd\ne", opts);
    expect(texts(song, "Verse 1")).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });

  it("drops a lyric's indent and moves its chords with it", () => {
    const song = parseSongText("[Bridge]\nA2      E\n  Even when I don't see it", opts);
    expect(song.sections[0].slides[0][0]).toEqual({
      text: "Even when I don't see it",
      chords: [
        { at: 0, chord: "A2" },
        { at: 6, chord: "E" },
      ],
    });
  });

  it("squeezes the gaps chord sheets leave between words", () => {
    const song = parseSongText("[Verse]\n  G            C\nI worship You      I worship You", opts);
    expect(song.sections[0].slides[0][0]).toEqual({
      text: "I worship You I worship You",
      chords: [
        { at: 2, chord: "G" },
        { at: 13, chord: "C" },
      ],
    });
  });

  it("sizes slides evenly instead of leaving one stray line", () => {
    const song = parseSongText("[Verse 1]\na\nb\nc\nd\ne", { linesPerSlide: 4 });
    expect(texts(song, "Verse 1")).toEqual([["a", "b", "c"], ["d", "e"]]);
  });

  it("plays a section written out twice in a row twice", () => {
    const song = parseSongText("[Chorus]\nla\nlo\n\n[Bridge]\nb\n\nb\n\nb\n\n[Chorus]\nla\nlo\n\nla\nlo", opts);
    expect(song.arrangement).toEqual(["Chorus", "Bridge", "Bridge", "Bridge", "Chorus", "Chorus"]);
    expect(texts(song, "Bridge")).toEqual([["b"]]);
    expect(song.sections.map((s) => s.name)).toEqual(["Chorus", "Bridge"]);
  });

  it("repeats a section marked x2", () => {
    const song = parseSongText("[Chorus] x2\nla\n\n[Verse 1]\nv\n\n[Chorus x3]", opts);
    expect(song.arrangement).toEqual(["Chorus", "Chorus", "Verse 1", "Chorus", "Chorus", "Chorus"]);
  });

  it("names header-less lyrics: repeated block is the chorus", () => {
    const song = parseSongText("one\ntwo\n\nchorus line\nchorus two\n\nthree\nfour\n\nchorus line\nchorus two", opts);
    expect(song.arrangement).toEqual(["Verse 1", "Chorus", "Verse 2", "Chorus"]);
    expect(song.sections.map((s) => s.name)).toEqual(["Verse 1", "Chorus", "Verse 2"]);
  });

  it("keeps two different sections that share a header", () => {
    const song = parseSongText("[Chorus]\nfirst\n\n[Chorus]\nsecond", opts);
    expect(song.arrangement).toEqual(["Chorus", "Chorus 2"]);
  });

  it("understands ChordPro", () => {
    const song = parseSongText(
      `{title: Amazing Grace}
{key: G}
{c: Verse 1}
[G]Amazing [C]grace
{soc}
[D]Chorus line
{eoc}`,
      opts,
    );
    expect(song.title).toBe("Amazing Grace");
    expect(song.key).toBe("G");
    expect(song.arrangement).toEqual(["Verse 1", "Chorus"]);
    expect(song.sections[0].slides[0][0]).toEqual({
      text: "Amazing grace",
      chords: [
        { at: 0, chord: "G" },
        { at: 8, chord: "C" },
      ],
    });
  });

  it("drops chord-only instrumental lines", () => {
    const song = parseSongText("[Intro]\nG  D  Em  C\n\n[Verse 1]\nWords", opts);
    expect(song.sections.find((s) => s.name === "Intro")?.slides).toEqual([]);
    expect(texts(song, "Verse 1")).toEqual([["Words"]]);
  });
});

describe("songToText", () => {
  it("round-trips sections, slides, chords and arrangement", () => {
    const original = parseSongText(
      `[Verse 1]
C        F
Amazing grace how sweet
the sound

[Chorus]
It is well

[Verse 2]
Through many dangers

[Chorus]`,
      opts,
    );
    const asInput = {
      sections: original.sections.map((s) => ({ name: s.name, slides: s.slides.map((lines) => ({ lines })) })),
      arrangement: original.arrangement,
    };
    const again = parseSongText(songToText(asInput), opts);
    expect(again.arrangement).toEqual(original.arrangement);
    expect(again.sections).toEqual(original.sections);
  });
});
