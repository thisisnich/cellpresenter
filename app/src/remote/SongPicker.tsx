import { useEffect, useMemo, useState } from "react";
import type { Setlist } from "../generated/Setlist";
import type { SongSummary } from "../generated/SongSummary";
import { t } from "../i18n";
import { api } from "../lib/api";
import type { LiveState } from "../lib/ws";

// Full-screen sheet for changing what's on air: tonight's setlist first,
// then the whole library with search.
export function SongPicker({
  live,
  onShowItem,
  onShowSong,
  onClose,
}: {
  live: LiveState;
  onShowItem: (setlistId: string, itemId: string) => void;
  onShowSong: (songId: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"setlist" | "library">(live.setlist_id ? "setlist" : "library");
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<SongSummary[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (live.setlist_id) api.getSetlist(live.setlist_id).then(setSetlist).catch(() => setSetlist(null));
    api.listSongs().then(setSongs).catch(() => setSongs([]));
  }, [live.setlist_id]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (songs ?? []).filter((s) => !q || s.title.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));
  }, [songs, query]);

  const tabClass = (on: boolean) => `flex-1 py-3 font-semibold ${on ? "border-b-2 border-cp-live text-cp-text" : "text-cp-muted"}`;

  return (
    <div role="dialog" aria-label={t("remote.changeSong")} className="fixed inset-0 z-20 flex flex-col bg-cp-bg font-ui text-cp-text">
      <header className="flex items-center justify-between border-b-cp px-4 py-3">
        <h2 className="m-0 text-lg font-semibold">{t("remote.changeSong")}</h2>
        <button type="button" onClick={onClose} className="cp-btn px-4 py-2">
          {t("editor.close")}
        </button>
      </header>
      <div className="flex border-b-cp" role="tablist">
        {live.setlist_id && (
          <button type="button" role="tab" aria-selected={tab === "setlist"} onClick={() => setTab("setlist")} className={tabClass(tab === "setlist")}>
            {setlist?.name ?? t("panel.setlist")}
          </button>
        )}
        <button type="button" role="tab" aria-selected={tab === "library"} onClick={() => setTab("library")} className={tabClass(tab === "library")}>
          {t("panel.library")}
        </button>
      </div>

      {tab === "setlist" && setlist && (
        <ul className="m-0 flex flex-1 list-none flex-col overflow-y-auto p-2">
          {setlist.items.map((item, i) => {
            const onAir = live.item_id === item.id;
            const missing = item.kind === "song" && item.missing;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={missing}
                  onClick={() => onShowItem(setlist.id, item.id)}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-cp px-3 text-left text-base disabled:opacity-40 ${onAir ? "bg-cp-surface-hi font-semibold" : ""}`}
                  style={onAir ? { boxShadow: "inset 0 0 0 var(--cp-highlight-width) var(--cp-live)" } : undefined}
                >
                  <span className="w-6 font-mono text-sm text-cp-muted">{i + 1}</span>
                  <span className="flex-1 truncate">{item.title || t("setlist.announcement")}</span>
                  <span className="font-mono text-xs text-cp-muted">
                    {onAir ? <span className="text-cp-live">{t("slides.live")}</span> : item.kind === "song" ? (item.key ?? "") : t("setlist.notice")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {tab === "library" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="p-3">
            <label htmlFor="remote-search" className="sr-only">
              {t("library.search")}
            </label>
            <input
              id="remote-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("library.search")}
              className="h-12 w-full rounded-cp border-cp bg-cp-panel px-3 text-base"
            />
          </div>
          <ul className="m-0 flex flex-1 list-none flex-col overflow-y-auto px-2 pb-4">
            {matches.map((song) => {
              const onAir = live.song_id === song.id && !live.setlist_id;
              return (
                <li key={song.id}>
                  <button
                    type="button"
                    onClick={() => onShowSong(song.id)}
                    className={`flex min-h-14 w-full flex-col justify-center rounded-cp px-3 text-left ${onAir ? "bg-cp-surface-hi" : ""}`}
                  >
                    <span className="text-base">{song.title}</span>
                    {song.artist && <span className="text-sm text-cp-muted">{song.artist}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
