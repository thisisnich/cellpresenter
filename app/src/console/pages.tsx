import type { DockviewApi } from "dockview-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { openEditor } from "./openEditor";

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
  /** Open a song (null: a new one) in the Edit page and go there. */
  editSong: (songId: string | null, title?: string) => void;
}

const PagesContext = createContext<PagesValue | null>(null);

export function PagesProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>("show");
  const docks = useRef(new Map<Page, DockviewApi>());
  // Pages are built the first time they're shown (so their panels get real
  // sizes); songs to edit before then wait here.
  const pendingEdits = useRef<{ songId: string | null; title?: string }[]>([]);
  const dockOf = useCallback((p: Page) => docks.current.get(p) ?? null, []);
  const register = useCallback((p: Page, api: DockviewApi) => {
    docks.current.set(p, api);
    if (p === "edit") {
      for (const e of pendingEdits.current.splice(0)) openEditor(api, e.songId, e.title);
    }
  }, []);
  const editSong = useCallback((songId: string | null, title?: string) => {
    const dock = docks.current.get("edit");
    if (dock) openEditor(dock, songId, title);
    else pendingEdits.current.push({ songId, title });
    setPage("edit");
  }, []);
  const value = useMemo(() => ({ page, setPage, dockOf, register, editSong }), [page, dockOf, register, editSong]);
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
