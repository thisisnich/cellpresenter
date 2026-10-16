import { createContext, useContext, useEffect, useState } from "react";
import type { Look } from "../generated/Look";
import type { LyricFont } from "../generated/LyricFont";

// The screen look (font, colour, position…) for everything that draws
// lyrics: the displays, and the console's previews so they match.

export const DEFAULT_LOOK: Look = {
  footer: "first",
  footer_place: "centre",
  ccli_licence: null,
  font: "inter",
  bold: true,
  uppercase: false,
  color: "#ffffff",
  shadow: true,
  position: "middle",
  margin: 5,
  text_area: { x: 10, y: 10, w: 80, h: 80 },
  footer_x: 50,
  footer_y: 96,
  title_slide: false,
  fade_ms: 0,
};

/** CSS font families of the bundled lyric fonts. */
export const FONT_FAMILY: Record<LyricFont, string> = {
  inter: '"Inter Variable", system-ui, sans-serif',
  montserrat: '"Montserrat Variable", system-ui, sans-serif',
  open_sans: '"Open Sans Variable", system-ui, sans-serif',
  oswald: '"Oswald Variable", system-ui, sans-serif',
  lora: '"Lora Variable", Georgia, serif',
};

export const FONT_NAME: Record<LyricFont, string> = {
  inter: "Inter",
  montserrat: "Montserrat",
  open_sans: "Open Sans",
  oswald: "Oswald",
  lora: "Lora",
};

export const LookContext = createContext<Look>(DEFAULT_LOOK);
export const useLook = () => useContext(LookContext);

/** The CSS `font` shorthand for measuring and drawing lyrics. */
export const fontOf = (look: Look, size: number) => `${look.bold ? 700 : 400} ${size}px ${FONT_FAMILY[look.font]}`;

/**
 * Whether the look's font has loaded. Lyrics are measured to fit, and a
 * fallback font would fit differently, so they're measured again once the
 * real font arrives.
 */
export function useFontReady(look: Look): boolean {
  const font = fontOf(look, 90);
  const check = () => typeof document.fonts?.check !== "function" || document.fonts.check(font);
  const [ready, setReady] = useState(check);
  useEffect(() => {
    if (check()) return setReady(true);
    setReady(false);
    let live = true;
    document.fonts
      .load(font)
      .then(() => live && setReady(true))
      .catch(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [font]);
  return ready;
}
