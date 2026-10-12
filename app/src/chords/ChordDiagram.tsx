import type { GuitarShape } from "../domain/guitarShapes";
import { shapeName } from "../domain/guitarShapes";
import { t } from "../i18n";

const FRETS = 5;
const W = 84;
const H = 104;
const LEFT = 14;
const TOP = 18;
const GAP_X = (W - LEFT - 10) / 5;
const GAP_Y = (H - TOP - 6) / FRETS;

// One guitar chord box: strings run top to bottom, low E on the left.
// Dots are fingers, o is an open string, x is not played.
export function ChordDiagram({ shape, label, size = 1 }: { shape: GuitarShape; label?: string; size?: number }) {
  const x = (string: number) => LEFT + string * GAP_X;
  const y = (fret: number) => TOP + (fret - shape.baseFret + 0.5) * GAP_Y;
  const name = shapeName(shape);
  return (
    <figure className="m-0 flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} width={W * size} height={H * size} role="img" aria-label={t("chords.shapeLabel", { shape: name })} className="text-cp-text">
        {shape.baseFret === 1 ? (
          <rect x={x(0)} y={TOP - 3} width={x(5) - x(0)} height={3} fill="currentColor" />
        ) : (
          <text x={2} y={TOP + GAP_Y * 0.65} fontSize={10} fill="var(--cp-muted)" className="font-mono">
            {shape.baseFret}
          </text>
        )}
        {Array.from({ length: FRETS + 1 }, (_, i) => (
          <line key={`f${i}`} x1={x(0)} x2={x(5)} y1={TOP + i * GAP_Y} y2={TOP + i * GAP_Y} stroke="var(--cp-line)" strokeWidth={1} />
        ))}
        {Array.from({ length: 6 }, (_, s) => (
          <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={TOP} y2={TOP + FRETS * GAP_Y} stroke="var(--cp-muted)" strokeWidth={1} />
        ))}
        {shape.barre && (
          <rect
            x={x(shape.barre.from) - 4}
            y={y(shape.barre.fret) - 4}
            width={x(shape.barre.to) - x(shape.barre.from) + 8}
            height={8}
            rx={4}
            fill="var(--cp-live)"
          />
        )}
        {shape.frets.map((f, s) =>
          f === null ? (
            <text key={s} x={x(s)} y={TOP - 7} fontSize={9} textAnchor="middle" fill="var(--cp-muted)">
              ×
            </text>
          ) : f === 0 ? (
            <circle key={s} cx={x(s)} cy={TOP - 10} r={3} fill="none" stroke="var(--cp-muted)" strokeWidth={1.2} />
          ) : (
            <circle key={s} cx={x(s)} cy={y(f)} r={4.5} fill="var(--cp-live)" />
          ),
        )}
      </svg>
      {label !== "" && <figcaption className="font-mono text-[11px] text-cp-muted">{label ?? name}</figcaption>}
    </figure>
  );
}
