import { keyInfo } from "../domain/chordSheet";
import { keyName, parseKey, transposeKey } from "../domain/chords";
import { t } from "../i18n";

// Key and capo pickers for one device. With a known song key the key is
// chosen by name; without one it's moved in semitones.
export function ChordControls({
  songKey,
  semitones,
  capo,
  onChange,
  compact = false,
}: {
  songKey: string | null;
  semitones: number;
  capo: number;
  onChange: (change: { semitones?: number; capo?: number }) => void;
  compact?: boolean;
}) {
  const key = songKey ? parseKey(songKey) : null;
  const info = keyInfo(songKey, { semitones, capo });
  const field = compact ? "h-8" : "h-11";
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="cp-label">{t("chords.key")}</span>
        {key ? (
          <select
            value={semitones}
            onChange={(e) => onChange({ semitones: Number(e.target.value) })}
            className={`${field} rounded-cp border-cp bg-cp-bg px-2 font-mono text-cp-text`}
          >
            {Array.from({ length: 12 }, (_, i) => i - 5).map((n) => (
              <option key={n} value={n}>
                {keyName(transposeKey(key, n))}
                {n === 0 ? ` (${t("chords.original")})` : ""}
              </option>
            ))}
          </select>
        ) : (
          <span className="flex items-center gap-1">
            <button type="button" onClick={() => onChange({ semitones: semitones - 1 })} aria-label={t("chords.down")} className={`cp-btn ${field} px-3`}>
              −
            </button>
            <span className="w-10 text-center font-mono">{semitones > 0 ? `+${semitones}` : semitones}</span>
            <button type="button" onClick={() => onChange({ semitones: semitones + 1 })} aria-label={t("chords.up")} className={`cp-btn ${field} px-3`}>
              +
            </button>
          </span>
        )}
      </label>
      <label className="flex flex-col gap-1">
        <span className="cp-label">{t("chords.capo")}</span>
        <select
          value={capo}
          onChange={(e) => onChange({ capo: Number(e.target.value) })}
          className={`${field} rounded-cp border-cp bg-cp-bg px-2 font-mono text-cp-text`}
        >
          {Array.from({ length: 10 }, (_, i) => i).map((n) => (
            <option key={n} value={n}>
              {n === 0 ? t("chords.noCapo") : n}
            </option>
          ))}
        </select>
      </label>
      {info.shapes && <span className="pb-2 text-cp-muted">{t("chords.playShapes", { key: info.shapes })}</span>}
    </div>
  );
}
