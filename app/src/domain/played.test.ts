import { describe, expect, it } from "vitest";
import type { Song } from "../generated/Song";
import { announcementSlides, playedSlides } from "./played";

const line = (text: string) => ({ text, chords: [] });
const song = (arrangement: string[] | null): Song => ({
  id: "s",
  title: "S",
  artist: null,
  key: null,
  capo: 0,
  ccli_number: null,
  copyright: null,
  arrangement,
  sections: [
    { id: "v", name: "Verse 1", slides: [{ id: "v1", lines: [line("a"), line("b")] }] },
    { id: "c", name: "Chorus", slides: [{ id: "c1", lines: [line("c")] }] },
  ],
  updated_at: 0,
});

describe("playedSlides", () => {
  it("follows the arrangement, repeats included", () => {
    expect(playedSlides(song(["v", "c", "c"])).map((s) => s.section)).toEqual(["Verse 1", "Chorus", "Chorus"]);
    expect(playedSlides(song(["v"]))[0].text).toBe("a\nb");
  });

  it("falls back to section order", () => {
    expect(playedSlides(song(null))).toHaveLength(2);
    expect(playedSlides(song(["gone"]))).toHaveLength(2);
  });
});

describe("announcementSlides", () => {
  it("splits on blank lines and never comes out empty", () => {
    expect(announcementSlides("Potluck", "Potluck next Friday\nBring a dish\n\n\n7 pm")).toEqual([
      { section: "Potluck", text: "Potluck next Friday\nBring a dish" },
      { section: "Potluck", text: "7 pm" },
    ]);
    expect(announcementSlides("Welcome", "  ")).toEqual([{ section: "Welcome", text: "Welcome" }]);
  });
});
