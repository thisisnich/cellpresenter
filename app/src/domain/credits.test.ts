import { describe, expect, it } from "vitest";
import type { Credits } from "../generated/Credits";
import type { Look } from "../generated/Look";
import { footerLines, titleCard } from "./credits";

const song: Credits = { title: "Way Maker", artist: "Sinach", copyright: "2016 Integrity Music", ccli_number: "7115744", translation: null };
const look: Pick<Look, "footer" | "ccli_licence" | "title_slide"> = { footer: "first", ccli_licence: "123456", title_slide: false };

describe("footerLines", () => {
  it("credits the song on its first slide", () => {
    expect(footerLines(song, look, 0)).toEqual([
      "Way Maker — Sinach",
      "© 2016 Integrity Music · CCLI Song #7115744 · CCLI Licence #123456",
    ]);
    expect(footerLines(song, look, 1)).toBeNull();
    expect(footerLines(song, { ...look, footer: "all" }, 3)).not.toBeNull();
    expect(footerLines(song, { ...look, footer: "off" }, 0)).toBeNull();
  });

  it("shows public-domain songs without a licence number", () => {
    const hymn: Credits = { title: "Amazing Grace", artist: "John Newton", copyright: "Public domain", ccli_number: null, translation: null };
    expect(footerLines(hymn, look, 0)).toEqual(["Amazing Grace — John Newton", "Public domain"]);
  });

  it("shows a scripture reference on every slide", () => {
    const john: Credits = { title: "John 3:16–17", artist: null, copyright: null, ccli_number: null, translation: "KJV" };
    expect(footerLines(john, look, 1)).toEqual(["John 3:16–17 · KJV"]);
    expect(footerLines(john, { ...look, footer: "off" }, 0)).toBeNull();
  });

  it("stays off for songs with nothing to credit, and for announcements", () => {
    expect(footerLines({ ...song, copyright: null, ccli_number: " " }, look, 0)).toBeNull();
    expect(footerLines(null, look, 0)).toBeNull();
  });

  it("keeps a © the owner already wrote", () => {
    expect(footerLines({ ...song, copyright: "© 2016 Integrity", ccli_number: null }, look, 0)?.[1]).toBe("© 2016 Integrity");
  });
});

describe("titleCard", () => {
  const titled = { ...look, title_slide: true };

  it("shows the title, writers and the copyright line", () => {
    expect(titleCard(song, titled)).toEqual({
      title: "Way Maker",
      artist: "Sinach",
      details: "© 2016 Integrity Music · CCLI Song #7115744 · CCLI Licence #123456",
    });
  });

  it("takes over the first slide's copyright line", () => {
    expect(footerLines(song, titled, 0)).toBeNull();
    expect(footerLines(song, { ...titled, footer: "all" }, 0)).not.toBeNull();
  });

  it("is only for songs, and only when turned on", () => {
    expect(titleCard(song, look)).toBeNull();
    expect(titleCard({ ...song, translation: "KJV" }, titled)).toBeNull();
    expect(titleCard(null, titled)).toBeNull();
    expect(titleCard({ ...song, artist: " ", copyright: null, ccli_number: null }, titled)).toEqual({ title: "Way Maker", artist: null, details: null });
  });
});
