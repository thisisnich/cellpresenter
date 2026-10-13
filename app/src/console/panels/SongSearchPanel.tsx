import type { IDockviewPanelProps } from "dockview-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { draftFrom, songLink, ugSearchUrl } from "../../domain/importing";
import type { SearchHit } from "../../generated/SearchHit";
import type { Source } from "../../generated/Source";
import { t } from "../../i18n";
import { api, ApiError } from "../../lib/api";
import type { SearchParams } from "../openSearch";
import { usePages } from "../pages";

const hitKey = (hit: { source: Source; id: string }) => `${hit.source}:${hit.id}`;

const failure = (err: unknown, fallback: "search.offline" | "search.openFailed") =>
  err instanceof ApiError && err.code === "pin_required" ? t("search.needPin") : t(fallback);

// The app's own windows (and a browser on the same computer) load the app
// from this computer; phones load it over the network.
const onThisComputer = () => ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

// Find a song and open it in the editor, already split into sections and
// slides: lyrics by searching LRCLIB, chords by pasting an Ultimate Guitar
// link. Ultimate Guitar is searched in the browser, not by the app.
export function SongSearchPanel({ params }: IDockviewPanelProps<SearchParams>) {
  const { editSong } = usePages();
  const [query, setQuery] = useState(params.query ?? "");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  const link = songLink(query);

  const open = useCallback(
    async (hit: { source: Source; id: string }) => {
      setOpening(hitKey(hit));
      setError(null);
      try {
        const draft = draftFrom(await api.onlineSong(hit.source, hit.id));
        editSong(null, draft.title, draft);
      } catch (err) {
        setError(failure(err, "search.openFailed"));
      } finally {
        setOpening(null);
      }
    },
    [editSong],
  );

  const search = useCallback(
    async (words: string) => {
      const q = words.trim();
      if (!q) return;
      const pasted = songLink(q);
      if (pasted) return open(pasted);
      const ask = ++latest.current;
      setSearching(true);
      setError(null);
      try {
        const found = await api.searchLyrics(q);
        if (ask === latest.current) setHits(found);
      } catch (err) {
        if (ask === latest.current) setError(failure(err, "search.offline"));
      } finally {
        if (ask === latest.current) setSearching(false);
      }
    },
    [open],
  );

  const searchUg = async () => {
    const q = query.trim();
    if (!onThisComputer()) {
      window.open(ugSearchUrl(q), "_blank", "noopener");
      return;
    }
    try {
      await api.openUgSearch(q);
    } catch {
      setError(t("search.browserFailed"));
    }
  };

  // Asked from elsewhere (the Library's "Find online").
  useEffect(() => {
    if (!params.query) return;
    setQuery(params.query);
    void search(params.query);
    // Runs per request (`asked`), not when `search` changes.
  }, [params.asked]);

  const words = query.trim() && !link ? query.trim() : "";

  return (
    <div className="flex h-full flex-col bg-cp-panel font-ui text-[13px] text-cp-text">
      <form
        className="flex flex-col gap-2 border-b-cp p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void search(query);
        }}
      >
        <label htmlFor="song-search" className="sr-only">
          {t("search.label")}
        </label>
        <div className="flex gap-2">
          <input
            id="song-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="min-w-0 flex-1 rounded-cp border-cp bg-cp-bg px-2.5 py-1.5 text-cp-text placeholder:text-cp-muted"
          />
          <button type="submit" disabled={searching || opening !== null || !query.trim()} className="cp-btn px-3 py-1.5">
            {opening && link ? t("search.opening") : searching ? t("search.searching") : link ? t("search.import") : t("search.go")}
          </button>
        </div>
      </form>

      <section aria-labelledby="search-chords" className="flex flex-col gap-2 border-b-cp p-3">
        <h3 id="search-chords" className="cp-label m-0">
          {t("search.chordsTitle")}
        </h3>
        <p className="m-0 text-[12px] text-cp-muted">{t("search.chordsHow")}</p>
        <button type="button" onClick={() => void searchUg()} className="cp-btn self-start px-3 py-1.5">
          {words ? t("search.onUgFor", { query: words }) : t("search.onUg")}
        </button>
      </section>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-busy={searching}>
        {error && (
          <p role="alert" className="m-0 p-2 text-cp-danger">
            {error}
          </p>
        )}
        {!hits && !error && <p className="m-0 p-2 text-cp-muted">{t("search.intro")}</p>}
        {hits && hits.length === 0 && <p className="m-0 p-2 text-cp-muted">{t("search.noResults")}</p>}
        {hits?.map((hit) => {
          const key = hitKey(hit);
          return (
            <button
              key={key}
              type="button"
              disabled={opening !== null}
              onClick={() => void open(hit)}
              aria-label={t("search.open", { title: hit.title, artist: hit.artist ?? "" })}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-cp px-2 py-2 text-left hover:bg-cp-surface disabled:opacity-60"
            >
              <span className="truncate">{hit.title}</span>
              <span className="justify-self-end text-[11px] text-cp-muted">
                {opening === key ? t("search.opening") : t("search.lyrics")}
              </span>
              <span className="col-span-2 truncate text-[12px] text-cp-muted">{hit.artist}</span>
            </button>
          );
        })}
      </div>

      <p className="m-0 border-t-cp px-3 py-2 text-[11px] text-cp-muted">{t("search.licence")}</p>
    </div>
  );
}
