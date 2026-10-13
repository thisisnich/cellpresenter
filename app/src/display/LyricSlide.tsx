import { useMemo } from "react";
import { fitFontSize } from "../domain/fit";
import { lyricBox, lyricText } from "../domain/lyricLayout";
import type { Look } from "../generated/Look";
import { FONT_FAMILY, fontOf, useFontReady, useLook } from "./look";
import { STAGE_HEIGHT, STAGE_WIDTH } from "./Stage";

// A single slide's lyrics, rendered inside the fixed 1920x1080 stage canvas.
// Font size is in *canvas* pixels: the Stage scales everything uniformly, so
// it renders proportionally identical on every screen. Lines are shown
// exactly as written (never wrapped); the font shrinks until the widest line
// fits the look's box, so every device breaks lines in the same places.
// `textScale` is the operator's proportional size control (part of live state).
export const LYRIC_BASE_FONT_PX = 90;
const LINE_HEIGHT = 1.375;

let canvas: HTMLCanvasElement | null = null;
function measureLine(line: string, size: number, look: Look): number {
  canvas ??= document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return line.length * size * 0.55;
  ctx.font = fontOf(look, size);
  return ctx.measureText(line).width;
}

export function LyricSlide({ text, textScale }: { text: string; textScale: number }) {
  const look = useLook();
  const fontReady = useFontReady(look);
  const shown = lyricText(text, look);
  const box = lyricBox(look, STAGE_WIDTH, STAGE_HEIGHT);
  const fontSize = useMemo(
    () =>
      fitFontSize(shown.split("\n"), (line, size) => measureLine(line, size, look), {
        size: LYRIC_BASE_FONT_PX * textScale,
        maxWidth: box.width,
        maxHeight: box.height,
        lineHeight: LINE_HEIGHT,
      }),
    // `fontReady` re-measures once the real font has loaded.
    [shown, textScale, look, box.width, box.height, fontReady],
  );
  return (
    <div
      className="absolute flex justify-center"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height, alignItems: box.align }}
    >
      <p
        className="m-0 whitespace-pre text-center"
        style={{
          fontSize,
          lineHeight: LINE_HEIGHT,
          fontFamily: FONT_FAMILY[look.font],
          fontWeight: look.bold ? 700 : 400,
          color: look.color,
          // The shadow keeps lyrics legible over bright parts of a background.
          textShadow: look.shadow ? "0 4px 24px rgb(0 0 0 / 0.55), 0 2px 6px rgb(0 0 0 / 0.35)" : "none",
        }}
      >
        {shown}
      </p>
    </div>
  );
}
