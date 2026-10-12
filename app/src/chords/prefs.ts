import { useCallback, useEffect, useState } from "react";

// Chord view settings are per device: each musician picks their own key,
// capo and text size. Key and capo are remembered per song.

interface SongPrefs {
  semitones: number;
  capo: number;
}
interface ViewPrefs {
  fontScale: number;
  lyricsOnly: boolean;
}

const VIEW_KEY = "cellpresenter.chords.view";
const songKey = (id: string) => `cellpresenter.chords.song.${id}`;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not remembered; fine.
  }
}

export function useSongPrefs(songId: string | null) {
  const [prefs, setPrefs] = useState<SongPrefs>({ semitones: 0, capo: 0 });
  useEffect(() => {
    setPrefs(songId ? load(songKey(songId), { semitones: 0, capo: 0 }) : { semitones: 0, capo: 0 });
  }, [songId]);
  const update = useCallback(
    (change: Partial<SongPrefs>) =>
      setPrefs((p) => {
        const next = { ...p, ...change };
        if (songId) save(songKey(songId), next);
        return next;
      }),
    [songId],
  );
  return [prefs, update] as const;
}

export function useViewPrefs() {
  const [prefs, setPrefs] = useState<ViewPrefs>(() => load(VIEW_KEY, { fontScale: 1, lyricsOnly: false }));
  const update = useCallback(
    (change: Partial<ViewPrefs>) =>
      setPrefs((p) => {
        const next = { ...p, ...change };
        save(VIEW_KEY, next);
        return next;
      }),
    [],
  );
  return [prefs, update] as const;
}

interface StripPrefs {
  /** Show the strip of chord diagrams above the song. */
  shown: boolean;
  /** Keep the strip in view while the song scrolls. */
  pinned: boolean;
  /** The shape picked for each chord name ("x32010"); the easiest otherwise. */
  shapes: Record<string, string>;
}
const STRIP_KEY = "cellpresenter.chords.strip";

export function useStripPrefs() {
  const [prefs, setPrefs] = useState<StripPrefs>(() => load(STRIP_KEY, { shown: true, pinned: true, shapes: {} }));
  const update = useCallback(
    (change: Partial<StripPrefs>) =>
      setPrefs((p) => {
        const next = { ...p, ...change };
        save(STRIP_KEY, next);
        return next;
      }),
    [],
  );
  return [prefs, update] as const;
}
