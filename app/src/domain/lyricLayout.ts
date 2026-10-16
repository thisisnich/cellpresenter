// Where the words go on the 1920×1080 stage for a screen look: the box they
// must fit in, and how they sit inside it. Pure functions, no I/O.

import type { FooterPlace } from "../generated/FooterPlace";
import type { Look } from "../generated/Look";

export interface LyricBox {
  left: number;
  top: number;
  width: number;
  height: number;
  /** How the block of lines sits vertically in the box. */
  align: "start" | "center" | "end";
}

/** The box the lyrics fit in, in stage pixels. */
export function lyricBox(look: Pick<Look, "position" | "margin" | "text_area">, stageWidth: number, stageHeight: number): LyricBox {
  if (look.position === "custom") {
    const a = look.text_area;
    return {
      left: (stageWidth * a.x) / 100,
      top: (stageHeight * a.y) / 100,
      width: (stageWidth * a.w) / 100,
      height: (stageHeight * a.h) / 100,
      align: "center",
    };
  }
  const m = Math.min(20, Math.max(0, look.margin)) / 100;
  const padX = stageWidth * m;
  const padY = stageHeight * m;
  const width = stageWidth - 2 * padX;
  if (look.position === "middle") {
    return { left: padX, top: padY, width, height: stageHeight - 2 * padY, align: "center" };
  }
  // A third of the screen, at the top or the bottom (a "lower third").
  const height = stageHeight / 3 - padY;
  return look.position === "bottom"
    ? { left: padX, top: stageHeight - padY - height, width, height, align: "end" }
    : { left: padX, top: padY, width, height, align: "start" };
}

/** The words as they appear on screen. */
export function lyricText(text: string, look: Pick<Look, "uppercase">): string {
  return look.uppercase ? text.toLocaleUpperCase() : text;
}

/** The copyright line's preset spots, in percent of the stage. */
export const FOOTER_SPOTS: Record<Exclude<FooterPlace, "custom">, { x: number; y: number }> = {
  centre: { x: 50, y: 96.7 },
  corner: { x: 97.5, y: 96.7 },
  bottom_left: { x: 2.5, y: 96.7 },
  top_left: { x: 2.5, y: 3.3 },
  top_centre: { x: 50, y: 3.3 },
  top_right: { x: 97.5, y: 3.3 },
};

export interface FooterSpot {
  /** Percent of the stage. The line's own box lines up with this point in
   *  the same proportion (0 puts its left edge there, 100 its right). */
  x: number;
  y: number;
  align: "left" | "center" | "right";
  /** Centred lines run wide; lines off to a side are smaller. */
  centred: boolean;
}

/** Where the copyright line goes for a look. A preset along the bottom
 *  moves to the top when the words sit in the lower third, so the two
 *  never overlap. */
export function footerSpot(look: Pick<Look, "footer_place" | "footer_x" | "footer_y" | "position">): FooterSpot {
  let { x, y } = look.footer_place === "custom" ? { x: look.footer_x, y: look.footer_y } : FOOTER_SPOTS[look.footer_place];
  if (look.footer_place !== "custom" && look.position === "bottom" && y > 50) y = 100 - y;
  const align = x < 35 ? "left" : x > 65 ? "right" : "center";
  return { x, y, align, centred: align === "center" };
}
