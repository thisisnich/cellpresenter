import { useEffect } from "react";
import { guitarShapes, shapeName } from "../domain/guitarShapes";
import { t } from "../i18n";
import { ChordDiagram } from "./ChordDiagram";

// Every way to play one chord, easiest first. Opens when a chord is tapped
// in the sheet; the strip at the top jumps between the song's chords.
// Tapping a shape makes it the one shown above the song on this device.
export function ChordShapes({
  chord,
  songChords,
  picked,
  onPick,
  onPickShape,
  onClose,
}: {
  chord: string;
  songChords: string[];
  /** Name of the shape picked for this chord, if any. */
  picked?: string;
  onPick: (chord: string) => void;
  onPickShape: (shape: string) => void;
  onClose: () => void;
}) {
  const shapes = guitarShapes(chord);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={t("chords.shapesTitle", { chord })}
        className="flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-cp border-cp bg-cp-panel font-ui text-cp-text sm:rounded-cp"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b-cp px-4 py-3">
          <h2 className="m-0 font-mono text-2xl font-bold text-cp-live">{chord}</h2>
          <button type="button" onClick={onClose} className="cp-btn px-4 py-2">
            {t("editor.close")}
          </button>
        </header>
        {songChords.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto border-b-cp px-4 py-2" aria-label={t("chords.inThisSong")}>
            {songChords.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onPick(c)}
                aria-pressed={c === chord}
                className={`shrink-0 rounded-cp-sm px-2.5 py-1 font-mono text-sm ${c === chord ? "bg-cp-live text-cp-on-live" : "border-cp text-cp-text"}`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
        <div className="overflow-y-auto p-4">
          {shapes.length === 0 ? (
            <p className="m-0 text-cp-muted">{t("chords.noShapes")}</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] justify-items-center gap-4">
              {shapes.map((shape, i) => {
                const name = shapeName(shape);
                const on = picked ? picked === name : i === 0;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onPickShape(name)}
                    aria-pressed={on}
                    className="rounded-cp p-1.5"
                    style={{ boxShadow: on ? "inset 0 0 0 var(--cp-highlight-width) var(--cp-live)" : undefined }}
                  >
                    <ChordDiagram shape={shape} />
                  </button>
                );
              })}
            </div>
          )}
          <p className="m-0 mt-3 text-[12px] text-cp-muted">{t("chords.shapesHint")}</p>
        </div>
      </div>
    </div>
  );
}
