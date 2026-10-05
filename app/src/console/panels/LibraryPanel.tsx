import { useCallback, useEffect, useMemo, useState } from "react";
import type { SongSummary } from "../../generated/SongSummary";
import { t } from "../../i18n";
import { api } from "../../lib/api";
import { useLive } from "../LiveContext";

// Every song in the library, searchable. Clicking a song puts it on air.
export function LibraryPanel() {
  const { state, showSong } = useLive();
  const [songs, setSongs] = useState<SongSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      setSongs(await api.listSongs());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!songs || !q) return songs ?? [];
    return songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));
  }, [songs, query]);

  return (
    <div className="flex h-full flex-col bg-cp-panel font-ui text-[13px] text-cp-text">
      <div className="border-b-cp p-3">
        <label htmlFor="library-search" className="sr-only">
          {t("library.search")}
        </label>
        <input
          id="library-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={songs ? t("library.searchCount", { count: songs.length }) : t("library.search")}
          className="w-full rounded-cp border-cp bg-cp-bg px-2.5 py-1.5 text-cp-text placeholder:text-cp-muted"
        />
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {failed && (
          <p className="m-0 p-2 text-cp-danger">
            {t("library.loadFailed")}{" "}
            <button type="button" onClick={() => void load()} className="underline">
              {t("library.retry")}
            </button>
          </p>
        )}
        {songs && shown.length === 0 && (
          <p className="m-0 p-2 text-cp-muted">{query ? t("library.noMatches") : t("library.empty")}</p>
        )}
        {shown.map((song) => {
          const onAir = song.id === state?.song_id;
          return (
            <button
              key={song.id}
              type="button"
              onClick={() => void showSong(song.id)}
              aria-current={onAir ? "true" : undefined}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-cp px-2 py-2 text-left ${
                onAir ? "bg-cp-surface-hi font-semibold" : "hover:bg-cp-surface"
              }`}
            >
              <span className="truncate">{song.title}</span>
              <span className="font-mono text-[11px] text-cp-muted">{song.key ?? ""}</span>
              {song.artist && <span className="col-span-2 truncate text-[12px] font-normal text-cp-muted">{song.artist}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
