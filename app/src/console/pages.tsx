import type { DockviewApi } from "dockview-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { SongDraft } from "../domain/importing";
import { openEditor } from "./openEditor";
import { openSearch } from "./openSearch";

// The console has pages, like ProPresenter's modes: Show runs the service,
// Edit is for songs, Chords is for the worship leader. Each page is its own
// workspace with its own layout; the Layout menu changes the page in front.
export const PAGES = ["show", "edit", "chords"] as const;
export type Page = (typeof PAGES)[number];

interface PagesValue {
  page: Page;
  setPage: (page: Page) => void;
  /** The workspace of a page, once it has loaded. */
  dockOf: (page: Page) => DockviewApi | null;
  register: (page: Page, api: DockviewApi) => void;
  /** Open a song (null: a new one, maybe from a draft) in the Edit page and go there. */
  editSong: (songId: string | null, title?: string, draft?: SongDraft) => void;
  /** Search song sites from the Edit page's Find songs panel. */
  findOnline: (query: string) => void;
}

const PagesContext = createContext<PagesValue | null>(null);

export function PagesProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>("show");
  const docks = useRef(new Map<Page, DockviewApi>());
  // Pages are built the first time they're shown (so their panels get real
  // sizes); things to open on the Edit page before then wait here.
  const pendingEdits = useRef<((api: DockviewApi) => void)[]>([]);
  const dockOf = useCallback((p: Page) => docks.current.get(p) ?? null, []);
  const register = useCallback((p: Page, api: DockviewApi) => {
    docks.current.set(p, api);
    if (p === "edit") for (const open of pendingEdits.current.splice(0)) open(api);
  }, []);
  const onEditPage = useCallback((open: (api: DockviewApi) => void) => {
    const dock = docks.current.get("edit");
    if (dock) open(dock);
    else pendingEdits.current.push(open);
    setPage("edit");
  }, []);
  const editSong = useCallback(
    (songId: string | null, title?: string, draft?: SongDraft) => onEditPage((api) => openEditor(api, songId, title, draft)),
    [onEditPage],
  );
  const findOnline = useCallback((query: string) => onEditPage((api) => openSearch(api, query)), [onEditPage]);
  const value = useMemo(
    () => ({ page, setPage, dockOf, register, editSong, findOnline }),
    [page, dockOf, register, editSong, findOnline],
  );
  return <PagesContext.Provider value={value}>{children}</PagesContext.Provider>;
}

export function usePages(): PagesValue {
  const value = useContext(PagesContext);
  if (!value) throw new Error("usePages outside PagesProvider");
  return value;
}

/** Which page a panel sits on (panels behave a little differently per page). */
export const PageContext = createContext<Page>("show");
export const usePage = () => useContext(PageContext);
