import { t } from "../i18n";

export const MIN_SCALE = 0.7;
export const MAX_SCALE = 2.2;
const STEP = 0.1;
const round = (n: number) => Math.round(n * 10) / 10;

// − and + for the chord sheet's text size.
export function TextSizeButtons({
  scale,
  onChange,
  compact = false,
}: {
  scale: number;
  onChange: (scale: number) => void;
  compact?: boolean;
}) {
  const size = compact ? "h-8 w-8" : "h-10 w-10";
  return (
    <span className="flex items-center gap-1" role="group" aria-label={t("chords.textSize")}>
      <button
        type="button"
        disabled={scale <= MIN_SCALE}
        onClick={() => onChange(round(Math.max(MIN_SCALE, scale - STEP)))}
        aria-label={t("chords.smaller")}
        title={t("chords.smaller")}
        className={`cp-btn ${size} p-0 text-lg`}
      >
        −
      </button>
      <button
        type="button"
        disabled={scale >= MAX_SCALE}
        onClick={() => onChange(round(Math.min(MAX_SCALE, scale + STEP)))}
        aria-label={t("chords.bigger")}
        title={t("chords.bigger")}
        className={`cp-btn ${size} p-0 text-lg`}
      >
        +
      </button>
    </span>
  );
}
