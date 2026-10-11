import { describe, expect, it } from "vitest";
import { t } from ".";
import { en } from "./en";

describe("t", () => {
  it("returns the English text for a key", () => {
    expect(t("transport.next")).toBe("Next →");
  });

  it("fills placeholders and leaves unknown ones alone", () => {
    expect(t("slides.goTo", { number: 2, section: "Chorus" })).toBe("Show slide 2: Chorus");
    expect(t("slides.goTo", { number: 2 })).toBe("Show slide 2: {section}");
  });

  it("has no empty strings", () => {
    for (const [key, text] of Object.entries(en)) {
      expect(text.trim(), key).not.toBe("");
    }
  });
});
