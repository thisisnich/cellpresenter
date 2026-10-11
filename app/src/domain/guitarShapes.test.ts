import { describe, expect, test } from "vitest";
import { guitarShapes, shapeName } from "./guitarShapes";

const first = (chord: string) => shapeName(guitarShapes(chord)[0]);

describe("guitarShapes", () => {
  test("the usual open shape comes first", () => {
    expect(first("C")).toBe("x32010");
    expect(first("G")).toBe("320003");
    expect(first("D")).toBe("xx0232");
    expect(first("Em")).toBe("022000");
    expect(first("Am")).toBe("x02210");
    expect(first("A7")).toBe("x02020");
    expect(first("Cmaj7")).toBe("x32000");
  });

  test("barre chords where there is no open shape", () => {
    expect(first("F")).toBe("133211");
    expect(first("Bm")).toBe("x24432");
    expect(first("Bb")).toBe("x13331");
    expect(guitarShapes("F")[0].barre).toEqual({ fret: 1, from: 0, to: 5 });
  });

  test("slash chords put the named note lowest", () => {
    expect(first("D/F#")).toBe("200232");
    expect(first("C/G")).toBe("332010");
  });

  test("other shapes move up the neck", () => {
    const shapes = guitarShapes("C");
    expect(shapes.length).toBeGreaterThan(3);
    expect(shapes.map(shapeName)).toContain("x35553");
    const higher = shapes.find((s) => shapeName(s) === "x35553")!;
    expect(higher.baseFret).toBe(3);
    expect(new Set(shapes.map(shapeName)).size).toBe(shapes.length);
  });

  test("flats, aliases and unknown chords", () => {
    expect(first("Asus")).toBe(first("Asus4"));
    expect(first("Gmaj")).toBe(first("G"));
    expect(guitarShapes("Hm")).toEqual([]);
    expect(guitarShapes("C13#11")).toEqual([]);
  });
});
