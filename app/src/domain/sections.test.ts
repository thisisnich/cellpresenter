import { describe, expect, it } from "vitest";
import { arrangementOf, currentJump, sectionAbbrev, sectionJumps, sectionKind } from "./sections";

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


describe("sectionJumps", () => {
  const slides = ["Verse 1", "Verse 1", "Chorus", "Verse 2", "Chorus"].map((section) => ({ section }));

  it("marks where each run of a section starts", () => {
    expect(sectionJumps(slides)).toEqual([
      { label: "V1", section: "Verse 1", index: 0 },
      { label: "C", section: "Chorus", index: 2 },
      { label: "V2", section: "Verse 2", index: 3 },
      { label: "C", section: "Chorus", index: 4 },
    ]);
  });

  it("finds the run the current slide is in", () => {
    const jumps = sectionJumps(slides);
    expect(currentJump(jumps, 1)?.index).toBe(0);
    expect(currentJump(jumps, 4)?.index).toBe(4);
    expect(currentJump([], 0)).toBeUndefined();
  });
});
