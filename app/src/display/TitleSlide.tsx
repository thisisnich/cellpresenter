import { useMemo } from "react";
import type { TitleCard } from "../domain/credits";
import { fitFontSize } from "../domain/fit";
import { lyricBox } from "../domain/lyricLayout";
import type { Look } from "../generated/Look";
import { FONT_FAMILY, fontOf, useFontReady, useLook } from "./look";
import { STAGE_HEIGHT, STAGE_WIDTH } from "./Stage";

// A song's title slide: its title, writers, and the copyright and CCLI line,
// in the same box and font as the words. Stage pixels, like LyricSlide.
const TITLE_PX = 120;
const SHADOW = "0 4px 24px rgb(0 0 0 / 0.55), 0 2px 6px rgb(0 0 0 / 0.35)";

let canvas: HTMLCanvasElement | null = null;
function measure(text: string, size: number, look: Look, bold: boolean): number {
  canvas ??= document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return text.length * size * 0.55;
  ctx.font = fontOf({ ...look, bold }, size);
  return ctx.measureText(text).width;
}

export function TitleSlide({ card }: { card: TitleCard }) {
  const look = useLook();
  const fontReady = useFontReady(look);
  const box = lyricBox(look, STAGE_WIDTH, STAGE_HEIGHT);
  const title = look.uppercase ? card.title.toLocaleUpperCase() : card.title;
  const size = useMemo(
    () =>
      fitFontSize([title], (line, s) => measure(line, s, look, true), {
        size: TITLE_PX,
        maxWidth: box.width,
        maxHeight: box.height * 0.5,
        lineHeight: 1.15,
      }),
    // `fontReady` re-measures once the real font has loaded.
    [title, look, box.width, box.height, fontReady],
  );
  // The smaller lines scale with the title, but never past these sizes.
  const artist = Math.min(56, size * 0.5);
  const details = Math.min(30, size * 0.3);
  return (
    <div
      className="absolute flex flex-col items-center justify-center gap-6 text-center"
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        justifyContent: { start: "flex-start", center: "center", end: "flex-end" }[box.align],
        fontFamily: FONT_FAMILY[look.font],
        color: look.color,
        textShadow: look.shadow ? SHADOW : "none",
      }}
    >
      <p className="m-0 whitespace-nowrap font-bold" style={{ fontSize: size, lineHeight: 1.15 }}>
        {title}
      </p>
      {card.artist && (
        <p className="m-0 max-w-full truncate" style={{ fontSize: artist, opacity: 0.9 }}>
          {card.artist}
        </p>
      )}
      {card.details && (
        <p className="m-0 mt-4 max-w-full" style={{ fontSize: details, opacity: 0.8, lineHeight: 1.4 }}>
          {card.details}
        </p>
      )}
    </div>
  );
}
