import { useEffect, useState, type ReactNode } from "react";
import { DEFAULT_LOOK, LookContext } from "../display/look";
import { GuideProvider } from "./FirstRunGuide";
import { DEFAULT_THEME } from "../theme/tokens";
import { Header } from "./Header";
import { addPanel, resetLayout } from "./layout";
import { PAGES, PagesProvider, usePages, type Page } from "./pages";
import { useConsole } from "./ConsoleContext";
import { useTransportKeys } from "../lib/transportKeys";
import { ConsoleProvider } from "./ConsoleContext";
import { LiveProvider, useLive } from "./LiveContext";
import { TransportBar } from "./TransportBar";
import { Workspace } from "./Workspace";

function TransportKeys() {
  const { send } = useLive();
  useTransportKeys(send);
  return null;
}

// A page is built the first time it's shown, then stays mounted (hidden)
// so an unsaved song edit survives a trip to the Show page.
function Shell() {
  const { page, setPage, dockOf, register, editSong } = usePages();
  const { state } = useLive();
  const { selection } = useConsole();
  const [opened, setOpened] = useState<Set<Page>>(() => new Set([page]));
  useEffect(() => setOpened((o) => (o.has(page) ? o : new Set(o).add(page))), [page]);

  const changePage = (next: Page) => {
    // Going to Edit with nothing open: edit the song being previewed, else
    // the song on air.
    const edit = dockOf("edit");
    const editing = edit?.panels.some((p) => p.id.startsWith("editor:")) ?? false;
    if (next === "edit" && !editing && selection?.kind === "song") return editSong(selection.songId);
    if (next === "edit" && !editing && state?.song_id) return editSong(state.song_id, state.title);
    setPage(next);
  };

  return (
    <div className="flex h-screen flex-col bg-cp-bg font-ui text-cp-text">
      <Header
        page={page}
        onPage={changePage}
        onResetLayout={() => {
          const dock = dockOf(page);
          if (dock) resetLayout(dock, page);
        }}
        onAddPanel={(kind) => {
          const dock = dockOf(page);
          if (dock) addPanel(dock, kind);
        }}
      />
      {PAGES.filter((p) => opened.has(p) || p === page).map((p) => (
        <div key={p} className={p === page ? "min-h-0 flex-1" : "hidden"}>
          <Workspace theme={DEFAULT_THEME} page={p} onReady={(api) => register(p, api)} />
        </div>
      ))}
      {page !== "edit" && <TransportBar />}
    </div>
  );
}

// Previews draw lyrics with the screens' current look.
function LiveLook({ children }: { children: ReactNode }) {
  const { state } = useLive();
  return <LookContext.Provider value={state?.look ?? DEFAULT_LOOK}>{children}</LookContext.Provider>;
}

// Operator console: header, dockable workspace, transport bar.
export default function ConsoleApp() {
  return (
    <LiveProvider>
      <LiveLook>
        <ConsoleProvider>
          <PagesProvider>
            <GuideProvider>
              <TransportKeys />
              <Shell />
            </GuideProvider>
          </PagesProvider>
        </ConsoleProvider>
      </LiveLook>
    </LiveProvider>
  );
}
