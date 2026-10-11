import { describe, expect, it } from "vitest";
import type { Song } from "../generated/Song";
import { longestSlide, newId, songForText, toSongInput } from "./songEditing";
import { parseSongText, songToText } from "./songText";

const meta = { title: " It Is Well ", artist: "", key: "C", capo: 0, sectionBackgrounds: { Chorus: "hills" } };

const stored: Song = {
  id: "song",
  title: "It Is Well",
  artist: null,
  key: "C",
  capo: 0,
  ccli_number: null,
  copyright: "Public domain",
  arrangement: ["v1", "c", "v2", "c"],
  sections: [
    { id: "v1", name: "Verse 1", background_id: null, slides: [{ id: "v1a", lines: [{ text: "a", chords: [] }], background_id: null }] },
    { id: "c", name: "Chorus", background_id: null, slides: [{ id: "ca", lines: [{ text: "b", chords: [] }], background_id: "pic" }] },
    { id: "v2", name: "Verse 2", background_id: null, slides: [{ id: "v2a", lines: [{ text: "c", chords: [] }, { text: "d", chords: [] }], background_id: null }] },
  ],
  updated_at: 0,
};

describe("newId", () => {
  it("makes v4 UUIDs", () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newId()).not.toBe(newId());
  });
});

describe("toSongInput", () => {
  it("keeps ids of sections and slides that survive an edit", () => {
    const text = songToText(songForText(stored)).replace("b", "b edited");
    const input = toSongInput(parseSongText(text, { linesPerSlide: longestSlide(stored) }), meta, stored);
    expect(input.title).toBe("It Is Well");
    expect(input.artist).toBeNull();
    expect(input.copyright).toBe("Public domain");
    expect(input.sections.map((s) => s.id)).toEqual(["v1", "c", "v2"]);
    expect(input.sections[1].slides[0]).toEqual({ id: "ca", lines: [{ text: "b edited", chords: [] }], background_id: "pic" });
    expect(input.arrangement).toEqual(["v1", "c", "v2", "c"]);
    expect(input.sections.map((s) => s.background_id)).toEqual([null, "hills", null]);
  });

  it("gives new sections fresh ids and drops a plain in-order arrangement", () => {
    const input = toSongInput(parseSongText("[Verse 1]\nx\n\n[Bridge]\ny", { linesPerSlide: 2 }), meta);
    expect(input.sections[1].id).toMatch(/-4/);
    expect(input.sections[1].slides[0].id).toBeNull();
    expect(input.arrangement).toBeNull();
  });
});
