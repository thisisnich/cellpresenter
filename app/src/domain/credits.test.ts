import { describe, expect, it } from "vitest";
import type { Credits } from "../generated/Credits";
import type { Look } from "../generated/Look";
import { footerLines } from "./credits";

const song: Credits = { title: "Way Maker", artist: "Sinach", copyright: "2016 Integrity Music", ccli_number: "7115744" };
const look: Look = { footer: "first", ccli_licence: "123456" };

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
    const hymn: Credits = { title: "Amazing Grace", artist: "John Newton", copyright: "Public domain", ccli_number: null };
    expect(footerLines(hymn, look, 0)).toEqual(["Amazing Grace — John Newton", "Public domain"]);
  });

  it("stays off for songs with nothing to credit, and for announcements", () => {
    expect(footerLines({ ...song, copyright: null, ccli_number: " " }, look, 0)).toBeNull();
    expect(footerLines(null, look, 0)).toBeNull();
  });

  it("keeps a © the owner already wrote", () => {
    expect(footerLines({ ...song, copyright: "© 2016 Integrity", ccli_number: null }, look, 0)?.[1]).toBe("© 2016 Integrity");
  });
});
