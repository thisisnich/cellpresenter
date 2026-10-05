import { describe, expect, it } from "vitest";
import { t } from ".";
import { en } from "./en";

describe("t", () => {
  it("returns the English text for a key", () => {
    expect(t("console.next")).toBe("Next →");
  });

  it("fills placeholders and leaves unknown ones alone", () => {
    expect(t("display.slideCount", { current: 2, total: 5 })).toBe("2 / 5");
    expect(t("display.slideCount", { current: 2 })).toBe("2 / {total}");
  });

  it("has no empty strings", () => {
    for (const [key, text] of Object.entries(en)) {
      expect(text.trim(), key).not.toBe("");
    }
  });
});
