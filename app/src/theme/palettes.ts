import { useSyncExternalStore } from "react";
import { setFavicon } from "../brand/appIcon";
import { applyTheme, DEFAULT_THEME, type Theme, type ThemeColors } from "./tokens";

// The colour palettes a person can pick, their own saved palettes, and the
// colours they've changed on top. All of it is per device: each computer or
// phone keeps its own.

const base = DEFAULT_THEME.colors;

export const PALETTES: Theme[] = [
  DEFAULT_THEME,
  {
    ...DEFAULT_THEME,
    name: "Graphite",
    colors: {
      ...base,
      bg: "#17181A",
      chrome: "#1F2023",
      panel: "#1B1C1F",
      surface: "#26282C",
      surfaceHi: "#34363C",
      hover: "#3D3424",
      hoverLine: "#F7C066",
      line: "#2C2E33",
      text: "#ECECEE",
      muted: "#A0A3AA",
      live: "#F5A524",
      onLive: "#1A1206",
      next: "#6EA8FF",
      checkerA: "#141517",
      checkerB: "#202226",
      markInk: "#ECECEE",
      markCorner: "#F5A524",
      markPlay: "#F5A524",
      iconTile: "#1F2023",
    },
  },
  {
    ...DEFAULT_THEME,
    name: "Violet",
    colors: {
      ...base,
      bg: "#17151C",
      chrome: "#1F1C25",
      panel: "#1B1921",
      surface: "#28242F",
      surfaceHi: "#36313F",
      hover: "#362D52",
      hoverLine: "#B9A3FF",
      line: "#2E2A36",
      text: "#EEECF2",
      muted: "#A49FB0",
      live: "#9A7BFF",
      onLive: "#FFFFFF",
      next: "#F5A524",
      checkerA: "#141219",
      checkerB: "#211E27",
      markInk: "#EEECF2",
      markCorner: "#9A7BFF",
      markPlay: "#9A7BFF",
      iconTile: "#1F1C25",
    },
  },
  {
    ...DEFAULT_THEME,
    name: "Daylight",
    scheme: "light",
    colors: {
      ...base,
      bg: "#E9EDF1",
      chrome: "#FFFFFF",
      panel: "#F8FAFB",
      surface: "#FFFFFF",
      surfaceHi: "#DCE2E8",
      hover: "#DCE6FF",
      hoverLine: "#2F66F0",
      line: "#D1D8DF",
      text: "#20252B",
      muted: "#5A646E",
      live: "#2F66F0",
      onLive: "#FFFFFF",
      next: "#B86A00",
      ok: "#16884F",
      danger: "#C2352B",
      dangerBg: "#FCE8E6",
      dangerLine: "#F0B8B2",
      // Lyrics are white, so empty slides stay dark even in a light console.
      checkerA: "#5C6570",
      checkerB: "#525A64",
      markInk: "#20252B",
      markCorner: "#477BFF",
      markPlay: "#477BFF",
      iconTile: "#FFFFFF",
      iconInk: "#20252B",
    },
  },
];

export type ColorName = keyof ThemeColors;

export type ColorGroup = "accent" | "hover" | "logo" | "surfaces" | "text" | "status" | "sections";

/** The colour editor's groups, in the order the Settings page shows them. */
export const COLOR_GROUPS: { id: ColorGroup; colors: ColorName[] }[] = [
  { id: "accent", colors: ["live", "onLive", "next"] },
  { id: "hover", colors: ["hover", "hoverLine"] },
  { id: "logo", colors: ["markInk", "markCorner", "markPlay", "iconTile", "iconInk"] },
  { id: "surfaces", colors: ["bg", "chrome", "panel", "surface", "surfaceHi", "line", "checkerA", "checkerB"] },
  { id: "text", colors: ["text", "muted"] },
  { id: "status", colors: ["ok", "danger", "dangerBg", "dangerLine"] },
  { id: "sections", colors: ["sectionVerse", "sectionChorus", "sectionBridge", "sectionOther"] },
];

export interface ColorPrefs {
  /** The palette in use: a built-in one or one of `saved`. */
  palette: string;
  /** Colours changed on top of that palette, not saved as a palette yet. */
  custom: Partial<ThemeColors>;
  /** Palettes this person saved. */
  saved: Theme[];
}

const KEY = "cellpresenter.colors";
const DEFAULT_PREFS: ColorPrefs = { palette: DEFAULT_THEME.name, custom: {}, saved: [] };

/** Black or white, whichever reads better on `hex`. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return lum > 0.4 ? "#111317" : "#FFFFFF";
}

export const allPalettes = (prefs: ColorPrefs): Theme[] => [...PALETTES, ...prefs.saved];
export const isBuiltIn = (name: string) => PALETTES.some((p) => p.name === name);

/** A palette with the person's own colours on top. A new accent also sets
 *  the text on it and the logo's corner and play, unless those were changed
 *  too. */
export function resolveTheme(prefs: ColorPrefs): Theme {
  const palette = allPalettes(prefs).find((p) => p.name === prefs.palette) ?? DEFAULT_THEME;
  // Older saved palettes may lack newer colours; the default fills them in.
  const colors: ThemeColors = { ...DEFAULT_THEME.colors, ...palette.colors };
  const { live } = prefs.custom;
  if (live) Object.assign(colors, { live, onLive: readableOn(live), markCorner: live, markPlay: live });
  for (const [name, value] of Object.entries(prefs.custom)) if (name !== "live" && value) colors[name as ColorName] = value;
  return { ...palette, colors };
}

/** Saves the current colours as a new palette and switches to it. */
export function saveAsPalette(prefs: ColorPrefs, name: string): ColorPrefs {
  const taken = new Set(allPalettes(prefs).map((p) => p.name));
  let unique = name.trim() || "My palette";
  for (let i = 2; taken.has(unique); i++) unique = `${name.trim() || "My palette"} ${i}`;
  const theme = { ...resolveTheme(prefs), name: unique };
  return { palette: unique, custom: {}, saved: [...prefs.saved, theme] };
}

/** Writes the changed colours into the saved palette in use. */
export function updateSavedPalette(prefs: ColorPrefs): ColorPrefs {
  const theme = resolveTheme(prefs);
  return { ...prefs, custom: {}, saved: prefs.saved.map((p) => (p.name === prefs.palette ? theme : p)) };
}

export function deletePalette(prefs: ColorPrefs, name: string): ColorPrefs {
  const saved = prefs.saved.filter((p) => p.name !== name);
  return prefs.palette === name ? { palette: DEFAULT_THEME.name, custom: {}, saved } : { ...prefs, saved };
}

function load(): ColorPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw);
    return {
      palette: typeof p.palette === "string" ? p.palette : DEFAULT_PREFS.palette,
      custom: p.custom && typeof p.custom === "object" ? p.custom : {},
      saved: Array.isArray(p.saved) ? p.saved : [],
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

let prefs = load();
let theme = resolveTheme(prefs);
const listeners = new Set<() => void>();

/** Puts the chosen colours on the page (and the browser tab's icon). */
export function applyColors(): void {
  applyTheme(theme);
  setFavicon(theme.colors);
}

export function setColorPrefs(next: ColorPrefs): void {
  prefs = next;
  theme = resolveTheme(prefs);
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Not remembered on this device; fine.
  }
  applyColors();
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useTheme = () => useSyncExternalStore(subscribe, () => theme);
export const useColorPrefs = () => useSyncExternalStore(subscribe, () => prefs);
