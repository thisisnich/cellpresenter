import { describe, expect, it } from "vitest";
import { deletePalette, PALETTES, readableOn, resolveTheme, saveAsPalette, updateSavedPalette, type ColorPrefs } from "./palettes";
import { BRAND_BLUE, DEFAULT_THEME } from "./tokens";

const prefs = (p: Partial<ColorPrefs> = {}): ColorPrefs => ({ palette: DEFAULT_THEME.name, custom: {}, saved: [], ...p });

describe("palettes", () => {
  it("default to the logo blue as the accent", () => {
    const theme = resolveTheme(prefs());
    expect(theme.colors.live).toBe(BRAND_BLUE);
    expect(theme.colors.markCorner).toBe(BRAND_BLUE);
  });

  it("every palette sets every colour", () => {
    for (const p of PALETTES) {
      for (const name of Object.keys(DEFAULT_THEME.colors)) expect(p.colors[name as keyof typeof p.colors], `${p.name}.${name}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("a custom accent recolours the logo unless the logo colours are set too", () => {
    const accent = resolveTheme(prefs({ palette: "Graphite", custom: { live: "#00AA55" } }));
    expect(accent.colors.markCorner).toBe("#00AA55");
    expect(accent.colors.markPlay).toBe("#00AA55");
    const both = resolveTheme(prefs({ palette: "Graphite", custom: { live: "#00AA55", markPlay: "#FF0000" } }));
    expect(both.colors.markCorner).toBe("#00AA55");
    expect(both.colors.markPlay).toBe("#FF0000");
  });

  it("falls back to the default palette for an unknown name", () => {
    expect(resolveTheme(prefs({ palette: "Gone" })).name).toBe(DEFAULT_THEME.name);
  });

  it("saves changed colours as a new palette, with a name nobody has", () => {
    const first = saveAsPalette(prefs({ custom: { bg: "#000000" } }), "Mine");
    expect(first.palette).toBe("Mine");
    expect(first.custom).toEqual({});
    expect(resolveTheme(first).colors.bg).toBe("#000000");
    expect(saveAsPalette(first, "Mine").palette).toBe("Mine 2");
    expect(saveAsPalette(first, "Graphite").palette).toBe("Graphite 2");
  });

  it("updates and deletes a saved palette", () => {
    const mine = saveAsPalette(prefs(), "Mine");
    const updated = updateSavedPalette({ ...mine, custom: { text: "#FFFFFF" } });
    expect(resolveTheme(updated).colors.text).toBe("#FFFFFF");
    const gone = deletePalette(updated, "Mine");
    expect(gone.saved).toHaveLength(0);
    expect(gone.palette).toBe(DEFAULT_THEME.name);
  });

  it("fills in colours an older saved palette doesn't have", () => {
    const { iconTile: _, ...old } = DEFAULT_THEME.colors;
    const theme = resolveTheme(prefs({ palette: "Old", saved: [{ ...DEFAULT_THEME, name: "Old", colors: old as typeof DEFAULT_THEME.colors }] }));
    expect(theme.colors.iconTile).toBe(DEFAULT_THEME.colors.iconTile);
  });

  it("picks readable text on the accent", () => {
    expect(readableOn("#FFE066")).not.toBe("#FFFFFF");
    expect(readableOn(BRAND_BLUE)).toBe("#FFFFFF");
  });
});
