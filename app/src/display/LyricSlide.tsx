import { useMemo } from "react";
import { fitFontSize } from "../domain/fit";
import { STAGE_HEIGHT, STAGE_WIDTH } from "./Stage";

// A single slide's lyrics, rendered inside the fixed 1920x1080 stage canvas.
// Font size is in *canvas* pixels: the Stage scales everything uniformly, so
// it renders proportionally identical on every screen. Lines are shown
// exactly as written (never wrapped); the font shrinks until the widest line
// fits, so every device breaks lines in the same places.
// `textScale` is the operator's proportional size control (part of live state).
export const LYRIC_BASE_FONT_PX = 90;
export const LYRIC_FONT = '"Inter Variable", system-ui, sans-serif';
const LINE_HEIGHT = 1.375;

let canvas: HTMLCanvasElement | null = null;
function measureLine(line: string, size: number): number {
  canvas ??= document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return line.length * size * 0.55;
  ctx.font = `700 ${size}px ${LYRIC_FONT}`;
  return ctx.measureText(line).width;
}

export function LyricSlide({ text, textScale }: { text: string; textScale: number }) {
  const fontSize = useMemo(
    () =>
      fitFontSize(text.split("\n"), measureLine, {
        size: LYRIC_BASE_FONT_PX * textScale,
        maxWidth: STAGE_WIDTH * 0.9,
        maxHeight: STAGE_HEIGHT * 0.85,
        lineHeight: LINE_HEIGHT,
      }),
    [text, textScale],
  );
  return (
    <p
      className="relative m-0 whitespace-pre text-center font-bold text-white"
      // The shadow keeps lyrics legible over bright parts of a background.
      style={{ fontSize, lineHeight: LINE_HEIGHT, fontFamily: LYRIC_FONT, textShadow: "0 4px 24px rgb(0 0 0 / 0.55)" }}
    >
      {text}
    </p>
  );
}
