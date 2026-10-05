import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, themeCssVars } from "./tokens";

describe("themeCssVars", () => {
  it("turns every colour into a kebab-case --cp variable", () => {
    const vars = themeCssVars(DEFAULT_THEME);
    expect(vars["--cp-surface-hi"]).toBe(DEFAULT_THEME.colors.surfaceHi);
    expect(vars["--cp-section-chorus"]).toBe(DEFAULT_THEME.colors.sectionChorus);
    for (const name of Object.keys(DEFAULT_THEME.colors)) {
      const kebab = name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      expect(vars[`--cp-${kebab}`], name).toBeDefined();
    }
  });

  it("derives the small radius and never goes negative", () => {
    expect(themeCssVars({ ...DEFAULT_THEME, radius: 6 })["--cp-radius-sm"]).toBe("4px");
    expect(themeCssVars({ ...DEFAULT_THEME, radius: 1 })["--cp-radius-sm"]).toBe("0px");
  });
});
