import { useMemo, useState } from "react";
import { hasChords, keyInfo, sheetOf } from "../domain/chordSheet";
import { t } from "../i18n";
import { api, controlPinSet } from "../lib/api";
import { useLiveState } from "../lib/useLiveState";
import { ChordControls } from "./ChordControls";
import { ChordSheet } from "./ChordSheet";
import { useSongPrefs, useViewPrefs } from "./prefs";
import { TextSizeButtons } from "./TextSizeButtons";
import { useLiveSong } from "./useLiveSong";

// Musicians' view (/chords): the song on air as a chord sheet that follows
// the live slide. Read-only, so no PIN. Key, capo and text size are set per
// device.
export default function ChordsApp() {
  const { state, status } = useLiveState();
  const song = useLiveSong(state);
  const [prefs, setPrefs] = useSongPrefs(song?.id ?? null);
  const [view, setView] = useViewPrefs();
  const [showSettings, setShowSettings] = useState(false);
  const sheet = useMemo(() => (song ? sheetOf(song, prefs) : []), [song, prefs]);
  // Only trust the slide index once the sheet matches what's on air.
  const aligned = state && sheet.length === state.slides.length;
  const info = song ? keyInfo(song.key, prefs) : null;
  // On the computer running the app (or with the PIN) a click picks the
  // slide; musicians' phones only follow.
  const canControl = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) || controlPinSet();

  return (
    <main className="flex h-dvh flex-col bg-cp-bg font-ui text-cp-text">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b-cp bg-cp-chrome px-3 py-2">
        <div className="min-w-0">
          <h1 className="m-0 truncate text-lg font-semibold">{state?.title || t("remote.nothingOnAir")}</h1>
          <p className="m-0 text-sm text-cp-muted">
            {info?.sounding && t("chords.inKey", { key: info.sounding })}
            {info?.shapes && ` · ${t("chords.capoShapes", { capo: prefs.capo, key: info.shapes })}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span role="img" className={`size-2 rounded-full ${status === "open" ? "bg-cp-ok" : "bg-cp-danger"}`} aria-label={t(`connection.${status}`)} />
          <TextSizeButtons scale={view.fontScale} onChange={(fontScale) => setView({ fontScale })} />
          <button type="button" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings} className="cp-btn h-10 px-3">
            {t("chords.settings")}
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="flex flex-wrap items-end gap-4 border-b-cp bg-cp-panel px-3 py-3">
          {song && <ChordControls songKey={song.key} semitones={prefs.semitones} capo={prefs.capo} onChange={setPrefs} />}
          <label className="flex h-11 items-center gap-2">
            <input type="checkbox" checked={view.lyricsOnly} onChange={(e) => setView({ lyricsOnly: e.target.checked })} className="size-5 accent-[var(--cp-live)]" />
            {t("chords.lyricsOnly")}
          </label>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {!state && <p className="p-4 text-cp-muted">{t("connection.connecting")}</p>}
        {state && !state.song_id && state.slides.length > 0 && (
          // An announcement: just its words.
          <p className="m-0 p-4 text-xl whitespace-pre-line">{state.slides[state.slide_index]?.text}</p>
        )}
        {state && state.slides.length === 0 && <p className="p-4 text-cp-muted">{t("display.waiting")}</p>}
        {song && sheet.length > 0 && (
          <>
            {!hasChords(song) && !view.lyricsOnly && <p className="m-0 px-3 pb-2 text-sm text-cp-muted">{t("chords.noChords")}</p>}
            <ChordSheet
              slides={sheet}
              current={aligned ? state.slide_index : -1}
              fontScale={view.fontScale}
              lyricsOnly={view.lyricsOnly}
              onPick={aligned && canControl ? (index) => void api.liveCommand({ type: "go_to", index }).catch(() => undefined) : undefined}
            />
          </>
        )}
      </div>
    </main>
  );
}
