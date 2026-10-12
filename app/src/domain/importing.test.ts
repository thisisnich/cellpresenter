import { describe, expect, it } from "vitest";
import type { OnlineSong } from "../generated/OnlineSong";
import { cleanChordSheet, draftFrom, songLink, tidySongText } from "./importing";
import { parseSongText } from "./songText";

// Shaped like a real Ultimate Guitar sheet.
const UG_SHEET = `Capo 2
Tuning: E A D G B E

[Intro]
[ch]A2[/ch]  [ch]E[/ch]  [ch]Bsus[/ch]  [ch]C#m[/ch]

[Verse 1]
[tab]         [ch]A2[/ch]                  [ch]E[/ch]
You are here, moving in our midst[/tab]
[tab]          [ch]Bsus[/ch]               [ch]C#m[/ch]
I worship You      I worship You[/tab]

[Chorus]
[tab]         [ch]A2[/ch]                           [ch]E[/ch]
(You are)  Way maker, miracle worker, promise keeper[/tab]

[Solo]
e|-----0-----|
B|---3---3---|

[Bridge]
[ch]A2[/ch]
  Even when I don't see it, You're working

[ch]A2[/ch]
  Even when I don't see it, You're working

[Chorus]
[tab]         [ch]A2[/ch]                           [ch]E[/ch]
(You are)  Way maker, miracle worker, promise keeper[/tab]`;

const online = (over: Partial<OnlineSong>): OnlineSong => ({
  source: "ultimate_guitar",
  id: "leeland/way-maker-chords-2806757",
  title: "Way Maker",
  artist: "Leeland",
  key: "E",
  capo: null,
  text: UG_SHEET,
  url: "https://tabs.ultimate-guitar.com/tab/leeland/way-maker-chords-2806757",
  ...over,
});

describe("cleanChordSheet", () => {
  it("removes markup, tabs and info lines, and reads the capo", () => {
    const { text, capo } = cleanChordSheet(UG_SHEET);
    expect(capo).toBe(2);
    expect(text).not.toMatch(/\[\/?(tab|ch)\]|Tuning|e\|/);
    expect(text).toContain("You are here, moving in our midst");
    expect(text.startsWith("[Intro]")).toBe(true);
  });

  it("drops a label with only chords after it", () => {
    expect(cleanChordSheet("Intro: G D Em C\nWords").text).toBe("Words");
    expect(cleanChordSheet("Note: sing softly").text).toBe("Note: sing softly");
  });
});

describe("draftFrom", () => {
  it("turns a sheet into sections with chords and an arrangement", () => {
    const draft = draftFrom(online({}));
    expect(draft).toMatchObject({ title: "Way Maker", artist: "Leeland", key: "E", capo: 2 });
    const song = parseSongText(draft.text, { linesPerSlide: 2 });
    // Intro and Solo have no words, so they're gone; the bridge is played twice.
    expect(song.arrangement).toEqual(["Verse 1", "Chorus", "Bridge", "Bridge", "Chorus"]);
    const verse = song.sections.find((s) => s.name === "Verse 1")!;
    expect(verse.slides[0][0].chords.map((c) => c.chord)).toEqual(["A2", "E"]);
    // Chords keep the columns the sheet put them at.
    expect(verse.slides[0][0].chords.map((c) => c.at)).toEqual([9, 29]);
  });

  it("names plain lyrics by what repeats", () => {
    const draft = draftFrom(
      online({ source: "lrclib", id: "1", key: null, text: "one\ntwo\n\nhallelujah\namen\n\nthree\nfour\n\nhallelujah\namen" }),
    );
    expect(parseSongText(draft.text, { linesPerSlide: 2 }).arrangement).toEqual(["Verse 1", "Chorus", "Verse 2", "Chorus"]);
    expect(draft.capo).toBe(0);
  });
});

describe("tidySongText", () => {
  it("keeps stanzas whole for the editor to split", () => {
    expect(tidySongText("[Verse 1]\na\nb\nc\nd\ne")).toBe("[Verse 1]\na\nb\nc\nd\ne\n");
  });

  it("is empty when there are no words", () => {
    expect(tidySongText("[Intro]\nG D")).toBe("");
  });
});

describe("songLink", () => {
  it("knows Ultimate Guitar tab links", () => {
    expect(songLink(" https://tabs.ultimate-guitar.com/tab/leeland/way-maker-chords-2806757?foo=1 ")).toEqual({
      source: "ultimate_guitar",
      id: "leeland/way-maker-chords-2806757",
    });
    expect(songLink("https://www.ultimate-guitar.com/search.php?value=x")).toBeNull();
    expect(songLink("https://evil.com/tab/a/b")).toBeNull();
    expect(songLink("way maker")).toBeNull();
  });
});
