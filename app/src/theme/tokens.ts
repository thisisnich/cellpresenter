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
  /** Song section colours (slide labels, arrangement chips). */
  sectionVerse: string;
  sectionChorus: string;
  sectionBridge: string;
  sectionOther: string;
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

export const DEFAULT_THEME: Theme = {
  name: "Graphite",
  scheme: "dark",
  colors: {
    bg: "#17181A",
    chrome: "#1F2023",
    panel: "#1B1C1F",
    surface: "#26282C",
    surfaceHi: "#34363C",
    line: "#2C2E33",
    text: "#ECECEE",
    muted: "#A0A3AA",
    live: "#F5A524",
    onLive: "#1A1206",
    next: "#6EA8FF",
    ok: "#3DD68C",
    danger: "#FF8A8E",
    dangerBg: "#3A1D1F",
    dangerLine: "#5A2A2C",
    sectionVerse: "#2563EB",
    sectionChorus: "#7C3AED",
    sectionBridge: "#C2410C",
    sectionOther: "#4B5563",
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
