// Design tokens for the console UI (design direction A1 "Slide Grid").
// Every colour, radius and border width lives here and reaches the UI only
// as a CSS variable (`--cp-*`), so a colour swatch or a new theme is just a
// different Theme object. Components never hard-code colours or radii.

export interface ThemeColors {
  /** App background behind panels. */
  bg: string;
  /** Title bar, tab bars, transport bar. */
  chrome: string;
  /** Panel content background. */
  panel: string;
  /** Buttons and inputs. */
  surface: string;
  /** Pressed / selected buttons, selected rows. */
  surfaceHi: string;
  line: string;
  text: string;
  muted: string;
  /** What is on air: live slide ring, Next button, live labels. */
  live: string;
  /** Text on top of `live`. */
  onLive: string;
  /** The slide that comes next. */
  next: string;
  ok: string;
  danger: string;
  dangerBg: string;
  dangerLine: string;
  /** Checkerboard on slide thumbnails with no background of their own
   *  (transparent: whatever background is up stays). */
  checkerA: string;
  checkerB: string;
  /** Song section colours (slide labels, arrangement chips). */
  sectionVerse: string;
  sectionChorus: string;
  sectionBridge: string;
  sectionOther: string;
  /** The CellPresenter mark: its blocks, the accent corner block and the
   *  play triangle. */
  markInk: string;
  markCorner: string;
  markPlay: string;
  /** The app icon: its tile and its blocks (corner and play as the mark). */
  iconTile: string;
  iconInk: string;
}

export interface Theme {
  name: string;
  scheme: "dark" | "light";
  colors: ThemeColors;
  /** Corner radius in px; small elements use radius − 2. */
  radius: number;
  borderWidth: number;
  /** Ring width on the live and next slides. */
  highlightWidth: number;
  /** Gap between docked panels. */
  panelGap: number;
}

// The logo's blue, and the app's accent in the default palette.
export const BRAND_BLUE = "#477BFF";

export const DEFAULT_THEME: Theme = {
  name: "CellPresenter",
  scheme: "dark",
  colors: {
    bg: "#15181C",
    chrome: "#1C2025",
    panel: "#191C21",
    surface: "#242930",
    surfaceHi: "#323841",
    line: "#2A2F37",
    text: "#ECEEF1",
    muted: "#9EA5AF",
    live: BRAND_BLUE,
    onLive: "#FFFFFF",
    next: "#F5A524",
    ok: "#3DD68C",
    danger: "#FF8A8E",
    dangerBg: "#3A1D1F",
    dangerLine: "#5A2A2C",
    checkerA: "#121519",
    checkerB: "#1E2228",
    sectionVerse: "#2563EB",
    sectionChorus: "#7C3AED",
    sectionBridge: "#C2410C",
    sectionOther: "#4B5563",
    markInk: "#ECEEF1",
    markCorner: BRAND_BLUE,
    markPlay: BRAND_BLUE,
    iconTile: "#20252B",
    iconInk: "#FFFFFF",
  },
  radius: 6,
  borderWidth: 1,
  highlightWidth: 2,
  panelGap: 0,
};

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** The CSS variables a theme defines, e.g. `--cp-surface-hi`. */
export function themeCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(theme.colors)) {
    vars[`--cp-${kebab(name)}`] = value;
  }
  vars["--cp-radius"] = `${theme.radius}px`;
  vars["--cp-radius-sm"] = `${Math.max(0, theme.radius - 2)}px`;
  vars["--cp-border-width"] = `${theme.borderWidth}px`;
  vars["--cp-highlight-width"] = `${theme.highlightWidth}px`;
  vars["--cp-panel-gap"] = `${theme.panelGap}px`;
  return vars;
}

export function applyTheme(theme: Theme, el: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(themeCssVars(theme))) {
    el.style.setProperty(name, value);
  }
  el.style.colorScheme = theme.scheme;
}
