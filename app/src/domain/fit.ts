// Sizing lyrics to the stage: lines are never wrapped, so the font shrinks
// until the widest line fits and all lines fit vertically.

export interface FitOptions {
  /** Font size before fitting, in stage pixels. */
  size: number;
  maxWidth: number;
  maxHeight: number;
  /** Line height as a multiple of the font size. */
  lineHeight: number;
}

/**
 * The font size that fits `lines` in the box. `measure` returns a line's
 * width at `size`; width scales linearly with font size.
 */
export function fitFontSize(lines: string[], measure: (line: string, size: number) => number, o: FitOptions): number {
  const widest = Math.max(0, ...lines.map((l) => measure(l, o.size)));
  const byWidth = widest > o.maxWidth ? o.maxWidth / widest : 1;
  const height = lines.length * o.size * o.lineHeight;
  const byHeight = height > o.maxHeight ? o.maxHeight / height : 1;
  return o.size * Math.min(byWidth, byHeight);
}
