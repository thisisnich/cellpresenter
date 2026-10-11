import { describe, expect, it } from "vitest";
import { viewFromPath } from "./routes";

describe("viewFromPath", () => {
  it("maps /display to the display view", () => {
    expect(viewFromPath("/display")).toBe("display");
    expect(viewFromPath("/display/")).toBe("display");
    expect(viewFromPath("/remote")).toBe("remote");
    expect(viewFromPath("/chords")).toBe("chords");
  });

  it("falls back to the console for everything else", () => {
    expect(viewFromPath("/")).toBe("console");
    expect(viewFromPath("")).toBe("console");
    expect(viewFromPath("/displayx")).toBe("console");
  });
});
