import { MARK_PATHS, MARK_VIEWBOX, type MarkRole } from "./markPaths";

const FILL: Record<MarkRole, string> = {
  ink: "var(--cp-mark-ink)",
  corner: "var(--cp-mark-corner)",
  play: "var(--cp-mark-play)",
};

const [, , VB_W, VB_H] = MARK_VIEWBOX.split(" ").map(Number);

/** The CellPresenter mark, coloured by the theme's mark tokens. */
export function Mark({ size = 20, title }: { size?: number; title?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} height={size} width={(size * VB_W) / VB_H}role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} className="block shrink-0">
      {MARK_PATHS.map((p, i) => (
        <path key={i} d={p.d} fill={FILL[p.role]} transform={p.transform} />
      ))}
    </svg>
  );
}
