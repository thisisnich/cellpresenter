import type { IDockviewPanelProps } from "dockview-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { draftFrom, songLink } from "../../domain/importing";
import type { SearchHit } from "../../generated/SearchHit";
import type { SearchResults } from "../../generated/SearchResults";
import type { Source } from "../../generated/Source";
import { t } from "../../i18n";
import { api, ApiError } from "../../lib/api";
import type { SearchParams } from "../openSearch";
import { usePages } from "../pages";

type Filter = "all" | "chords" | "lyrics";
const FILTERS: Filter[] = ["all", "chords", "lyrics"];
const kindOf = (hit: SearchHit): Filter => (hit.source === "lrclib" ? "lyrics" : "chords");
const hitKey = (hit: { source: Source; id: string }) => `${hit.source}:${hit.id}`;

const failure = (err: unknown, fallback: "search.offline" | "search.openFailed") =>
  err instanceof ApiError && err.code === "pin_required" ? t("search.needPin") : t(fallback);

// Find a song online (chord sheets and lyrics) and open it in the editor,
// already split into sections and slides. A pasted Ultimate Guitar link
// opens that sheet straight away.
export function SongSearchPanel({ params }: IDockviewPanelProps<SearchParams>) {
  const { editSong } = usePages();
  const [query, setQuery] = useState(params.query ?? "");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

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
      const link = songLink(q);
      if (link) return open(link);
      const ask = ++latest.current;
      setSearching(true);
      setError(null);
      try {
        const found = await api.searchOnline(q);
        if (ask === latest.current) setResults(found);
      } catch (err) {
        if (ask === latest.current) setError(failure(err, "search.offline"));
      } finally {
        if (ask === latest.current) setSearching(false);
      }
    },
    [open],
  );

  // Asked from elsewhere (the Library's "Find online").
  useEffect(() => {
    if (!params.query) return;
    setQuery(params.query);
    void search(params.query);
    // Runs per request (`asked`), not when `search` changes.
  }, [params.asked]);

  const shown = useMemo(
    () => (results?.hits ?? []).filter((h) => filter === "all" || kindOf(h) === filter),
    [results, filter],
  );

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
          <button type="submit" disabled={searching || !query.trim()} className="cp-btn px-3 py-1.5">
            {searching ? t("search.searching") : t("search.go")}
          </button>
        </div>
        {results && (
          <div className="flex self-start rounded-cp border-cp bg-cp-bg p-0.5" role="group" aria-label={t("search.filter")}>
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-cp-sm px-2.5 py-0.5 ${filter === f ? "bg-cp-surface-hi font-semibold" : "text-cp-muted hover:text-cp-text"}`}
              >
                {t(`search.${f}`)}
              </button>
            ))}
          </div>
        )}
      </form>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-busy={searching}>
        {error && (
          <p role="alert" className="m-0 p-2 text-cp-danger">
            {error}
          </p>
        )}
        {!results && !error && <p className="m-0 p-2 text-cp-muted">{t("search.intro")}</p>}
        {results?.failed.map((source) => (
          <p key={source} className="m-0 p-2 text-cp-muted">
            {t("search.failedSite", { site: t(`search.source.${source}`) })}
          </p>
        ))}
        {results && shown.length === 0 && <p className="m-0 p-2 text-cp-muted">{t("search.noResults")}</p>}
        {shown.map((hit) => {
          const key = hitKey(hit);
          const busy = opening === key;
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
              <span className={`justify-self-end rounded-cp-sm px-1.5 text-[11px] ${kindOf(hit) === "chords" ? "bg-cp-surface-hi text-cp-text" : "text-cp-muted"}`}>
                {busy ? t("search.opening") : t(`search.${kindOf(hit)}`)}
              </span>
              <span className="truncate text-[12px] text-cp-muted">{hit.artist}</span>
              <span className="justify-self-end text-[11px] text-cp-muted">
                {[
                  hit.key && t("search.keyOf", { key: hit.key }),
                  hit.version && t("search.version", { version: hit.version }),
                  hit.votes != null && hit.rating != null && `★ ${hit.rating.toFixed(1)} · ${hit.votes}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          );
        })}
      </div>

      <p className="m-0 border-t-cp px-3 py-2 text-[11px] text-cp-muted">{t("search.licence")}</p>
    </div>
  );
}
