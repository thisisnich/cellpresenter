import { guitarShapes, shapeName, type GuitarShape } from "../domain/guitarShapes";
import { t } from "../i18n";
import { ChordDiagram } from "./ChordDiagram";

/** The shape to show for a chord: the one picked on this device, else the easiest. */
export function shapeFor(chord: string, picked: Record<string, string>): GuitarShape | undefined {
  const shapes = guitarShapes(chord);
  return shapes.find((s) => shapeName(s) === picked[chord]) ?? shapes[0];
}

function PinIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} aria-hidden="true" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.4}>
      <path d="M5.5 1.5h5l-.8 4.2 2.3 2.3v1.5H4V8l2.3-2.3z" strokeLinejoin="round" />
      <path d="M8 9.5v5" strokeLinecap="round" />
    </svg>
  );
}

// Every chord in the song as a small diagram above the sheet, like a chord
// chart's header. Pinned, it stays in view while the song scrolls. Tap a
// chord for its other shapes.
export function ChordStrip({
  chords,
  picked,
  pinned,
  surface,
  onOpen,
  onPin,
  onHide,
}: {
  chords: string[];
  picked: Record<string, string>;
  pinned: boolean;
  /** Background class matching the view, so the sheet doesn't show through. */
  surface: string;
  onOpen: (chord: string) => void;
  onPin: (pinned: boolean) => void;
  onHide: () => void;
}) {
  return (
    <div className={`${pinned ? "sticky top-0 z-10" : ""} ${surface} mb-2 border-b-cp`} aria-label={t("chords.inThisSong")} role="region">
      <div className="flex items-center justify-between gap-2 px-3 pt-1">
        <span className="cp-label">{t("chords.inThisSong")}</span>
        <span className="flex gap-1">
          <button
            type="button"
            onClick={() => onPin(!pinned)}
            aria-pressed={pinned}
            title={pinned ? t("chords.unpin") : t("chords.pinHelp")}
            className={`flex h-8 items-center gap-1.5 rounded-cp-sm px-2 text-[12px] ${pinned ? "text-cp-live" : "text-cp-muted"} hover:bg-cp-hover`}
          >
            <PinIcon on={pinned} />
            {pinned ? t("chords.pinned") : t("chords.pin")}
          </button>
          <button type="button" onClick={onHide} className="h-8 rounded-cp-sm px-2 text-[12px] text-cp-muted hover:bg-cp-hover">
            {t("chords.hideDiagrams")}
          </button>
        </span>
      </div>
      <div className="flex gap-1 overflow-x-auto px-2 pb-2">
        {chords.map((chord) => {
          const shape = shapeFor(chord, picked);
          return (
            <button
              key={chord}
              type="button"
              onClick={() => onOpen(chord)}
              title={t("chords.showShapes", { chord })}
              className="flex shrink-0 flex-col items-center rounded-cp px-1 pt-1 hover:bg-cp-hover"
            >
              <b className="font-mono text-[14px] text-cp-live">{chord}</b>
              {shape ? <ChordDiagram shape={shape} size={0.7} label="" /> : <span className="flex h-[73px] items-center text-[11px] text-cp-muted">?</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
