import { useMemo } from "react";
import { ChordControls } from "../../chords/ChordControls";
import { ChordSheet } from "../../chords/ChordSheet";
import { useSongPrefs } from "../../chords/prefs";
import { useLiveSong } from "../../chords/useLiveSong";
import { hasChords, sheetOf } from "../../domain/chordSheet";
import { t } from "../../i18n";
import { useLive } from "../LiveContext";

// The song on air as a chord sheet, for a worship leader at the console.
export function ChordsPanel() {
  const { state } = useLive();
  const song = useLiveSong(state);
  const [prefs, setPrefs] = useSongPrefs(song?.id ?? null);
  const sheet = useMemo(() => (song ? sheetOf(song, prefs) : []), [song, prefs]);
  const aligned = state && sheet.length === state.slides.length;

  if (!song) {
    return (
      <div className="flex h-full items-center justify-center bg-cp-panel p-6 font-ui text-[13px] text-cp-muted">
        <p className="m-0 max-w-[36ch] text-center">{t("chords.panelEmpty")}</p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col bg-cp-panel font-ui text-[13px] text-cp-text">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-cp px-4 py-2.5">
        <h1 className="m-0 text-lg font-semibold">{song.title}</h1>
        <ChordControls songKey={song.key} semitones={prefs.semitones} capo={prefs.capo} onChange={setPrefs} compact />
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!hasChords(song) && <p className="m-0 px-3 pb-2 text-cp-muted">{t("chords.noChords")}</p>}
        <ChordSheet slides={sheet} current={aligned ? state.slide_index : -1} fontScale={0.95} />
      </div>
    </div>
  );
}
