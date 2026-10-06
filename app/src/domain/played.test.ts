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
  background_id: null,
  sections: [
    { id: "v", name: "Verse 1", slides: [{ id: "v1", lines: [line("a"), line("b")], background_id: null }] },
    { id: "c", name: "Chorus", slides: [{ id: "c1", lines: [line("c")], background_id: "m1" }] },
  ],
  updated_at: 0,
});

describe("playedSlides", () => {
  it("follows the arrangement, repeats included", () => {
    expect(playedSlides(song(["v", "c", "c"])).map((s) => s.section)).toEqual(["Verse 1", "Chorus", "Chorus"]);
    expect(playedSlides(song(["v"]))[0].text).toBe("a\nb");
  });

  it("carries each slide's background cue and id", () => {
    const slides = playedSlides(song(null), (id) => `/media/${id}.jpg`);
    expect(slides.map((s) => s.background)).toEqual([null, "/media/m1.jpg"]);
    expect(slides[1].slide_id).toBe("c1");
  });

  it("falls back to section order", () => {
    expect(playedSlides(song(null))).toHaveLength(2);
    expect(playedSlides(song(["gone"]))).toHaveLength(2);
  });
});

describe("announcementSlides", () => {
  it("splits on blank lines and never comes out empty", () => {
    expect(announcementSlides("Potluck", "Potluck next Friday\nBring a dish\n\n\n7 pm").map((s) => s.text)).toEqual([
      "Potluck next Friday\nBring a dish",
      "7 pm",
    ]);
    expect(announcementSlides("Welcome", "  ")).toEqual([{ section: "Welcome", text: "Welcome", background: null, slide_id: null }]);
  });
});
