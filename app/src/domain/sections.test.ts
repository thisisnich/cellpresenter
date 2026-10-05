import { describe, expect, it } from "vitest";
import { arrangementOf, sectionAbbrev, sectionKind } from "./sections";

describe("sectionKind", () => {
  it("classifies common names", () => {
    expect(sectionKind("Verse 2")).toBe("verse");
    expect(sectionKind("Chorus")).toBe("chorus");
    expect(sectionKind("Bridge")).toBe("bridge");
    expect(sectionKind("Pre-Chorus")).toBe("other");
    expect(sectionKind("Tag")).toBe("other");
  });
});

describe("sectionAbbrev", () => {
  it("shortens names and keeps numbers", () => {
    expect(sectionAbbrev("Verse 1")).toBe("V1");
    expect(sectionAbbrev("Chorus")).toBe("C");
    expect(sectionAbbrev("Pre-Chorus 2")).toBe("PC2");
    expect(sectionAbbrev("Ending")).toBe("E");
  });
});

describe("arrangementOf", () => {
  it("collapses runs of the same section", () => {
    expect(arrangementOf(["Verse 1", "Verse 1", "Chorus", "Verse 2", "Chorus"])).toEqual([
      "Verse 1",
      "Chorus",
      "Verse 2",
      "Chorus",
    ]);
  });
});
