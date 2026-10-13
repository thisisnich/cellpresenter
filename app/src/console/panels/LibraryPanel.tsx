import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SONG_FILE_TYPES } from "../../domain/fileImport";
import type { SongSummary } from "../../generated/SongSummary";
import { t } from "../../i18n";
import { api } from "../../lib/api";
import { onLibraryChanged } from "../../lib/libraryEvents";
import { usePage, usePages } from "../pages";
import { newId } from "../../domain/songEditing";
import { useConsole } from "../ConsoleContext";
import { importSongFiles } from "../importFiles";
import { useLive } from "../LiveContext";

// Every song in the library, searchable. On the Show page, click a song to
// preview it in the Slides panel; on the Edit page, click to edit it.
// + adds it to the open setlist.
export function LibraryPanel() {
  const page = usePage();
  const { editSong, findOnline } = usePages();
  const { state } = useLive();
  const { select, selection, setlist, saveSetlist } = useConsole();
  const [songs, setSongs] = useState<SongSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [imported, setImported] = useState<{ ok: boolean; text: string } | null>(null);

  // Song files from other apps: one opens in the editor, several are saved.
  const importFiles = async (files: File[]) => {
    if (!files.length) return;
    setImporting(true);
    setImported(null);
    try {
      const result = await importSongFiles(files);
      if (result.single) editSong(null, result.single.title, result.single);
      const parts = [
        result.saved ? t("library.imported", { count: result.saved }) : "",
        result.failed.length ? t("library.importFailed", { files: result.failed.join(", ") }) : "",
      ].filter(Boolean);
      if (parts.length) setImported({ ok: result.failed.length === 0, text: parts.join(" ") });
    } finally {
      setImporting(false);
    }
  };

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
    return onLibraryChanged(() => void load());
  }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!songs || !q) return songs ?? [];
    return songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q));
  }, [songs, query]);

  return (
    <div
      className={`flex h-full flex-col bg-cp-panel font-ui text-[13px] text-cp-text ${dropping ? "outline-2 -outline-offset-2 outline-[var(--cp-live)] outline-dashed" : ""}`}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDropping(false);
        void importFiles([...e.dataTransfer.files]);
      }}
    >
      <div className="flex flex-col gap-2 border-b-cp p-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => editSong(null)} className="cp-btn flex-1">
            {t("library.newSong")}
          </button>
          <button
            type="button"
            disabled={importing}
            onClick={() => picker.current?.click()}
            title={t("library.importHelp")}
            className="cp-btn"
          >
            {importing ? t("library.importing") : t("library.import")}
          </button>
          <input
            ref={picker}
            type="file"
            multiple
            accept={SONG_FILE_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              void importFiles(files);
            }}
          />
        </div>
        {imported && (
          <p role={imported.ok ? "status" : "alert"} className={`m-0 text-[12px] ${imported.ok ? "text-cp-muted" : "text-cp-danger"}`}>
            {imported.text}
          </p>
        )}
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
          const selected = selection?.kind === "song" && selection.songId === song.id;
          return (
            <div
              key={song.id}
              className={`group flex items-stretch rounded-cp ${selected ? "bg-cp-surface-hi" : "hover:bg-cp-surface"}`}
              style={onAir ? { boxShadow: "inset 0 0 0 var(--cp-highlight-width) var(--cp-live)" } : undefined}
            >
              <button
                type="button"
                onClick={() => (page === "edit" ? editSong(song.id, song.title) : select({ kind: "song", songId: song.id }))}
                aria-current={onAir ? "true" : undefined}
                className={`grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-2 py-2 text-left ${onAir ? "font-semibold" : ""}`}
              >
                <span className="truncate">{song.title}</span>
                <span className="font-mono text-[11px] text-cp-muted">{song.key ?? ""}</span>
                {song.artist && <span className="col-span-2 truncate text-[12px] font-normal text-cp-muted">{song.artist}</span>}
              </button>
              {setlist && (
                <button
                  type="button"
                  onClick={() => void saveSetlist((items) => [...items, { kind: "song", id: newId(), song_id: song.id }])}
                  aria-label={t("library.addToSetlist", { title: song.title, setlist: setlist.name })}
                  title={t("library.addToSetlist", { title: song.title, setlist: setlist.name })}
                  className="px-1.5 text-[16px] leading-none text-cp-muted opacity-60 group-hover:opacity-100 hover:text-cp-live focus-visible:opacity-100"
                >
                  +
                </button>
              )}
              <button
                type="button"
                onClick={() => editSong(song.id, song.title)}
                aria-label={t("library.edit", { title: song.title })}
                title={t("library.edit", { title: song.title })}
                className="px-2 text-cp-muted opacity-60 group-hover:opacity-100 hover:text-cp-text focus-visible:opacity-100"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            </div>
          );
        })}
        {query.trim() && (
          <button type="button" onClick={() => findOnline(query.trim())} className="mt-1 rounded-cp px-2 py-2 text-left text-cp-muted hover:bg-cp-surface hover:text-cp-text">
            {t("library.findOnline", { query: query.trim() })}
          </button>
        )}
      </div>
    </div>
  );
}
