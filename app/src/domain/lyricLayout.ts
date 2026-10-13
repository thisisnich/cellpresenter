// Where the words go on the 1920×1080 stage for a screen look: the box they
// must fit in, and how they sit inside it. Pure functions, no I/O.

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
export function lyricBox(look: Pick<Look, "position" | "margin">, stageWidth: number, stageHeight: number): LyricBox {
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
