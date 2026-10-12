import type { DockviewApi } from "dockview-react";
import { useRef, useState } from "react";
import { DEFAULT_THEME } from "../theme/tokens";
import { Header, type Mode } from "./Header";
import { addPanel, focusPanel, kindOf, resetLayout } from "./layout";
import { useConsole } from "./ConsoleContext";
import { openEditor } from "./openEditor";
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

function modeOf(panelId: string | null): Mode | null {
  const kind = kindOf(panelId);
  if (kind === "slides") return "show";
  if (kind === "chords") return "chords";
  if (kind === "editor") return "edit";
  return null;
}

function Shell() {
  const dock = useRef<DockviewApi | null>(null);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const { state } = useLive();
  const { selection } = useConsole();

  const changeMode = (mode: Mode) => {
    const api = dock.current;
    if (!api) return;
    if (mode === "show") focusPanel(api, "slides");
    else if (mode === "chords") focusPanel(api, "chords");
    else {
      // Edit the song being previewed, else the song on air, else a new one.
      if (selection?.kind === "song") openEditor(api, selection.songId);
      else if (state?.song_id) openEditor(api, state.song_id, state.title);
      else openEditor(api, null);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-cp-bg font-ui text-cp-text">
      <Header
        mode={modeOf(activePanel)}
        onMode={changeMode}
        onResetLayout={() => dock.current && resetLayout(dock.current)}
        onAddPanel={(kind) => dock.current && addPanel(dock.current, kind)}
      />
      <div className="min-h-0 flex-1">
        <Workspace theme={DEFAULT_THEME} onReady={(api) => (dock.current = api)} onActivePanel={setActivePanel} />
      </div>
      <TransportBar />
    </div>
  );
}

// Operator console: header, dockable workspace, transport bar.
export default function ConsoleApp() {
  return (
    <LiveProvider>
      <ConsoleProvider>
        <TransportKeys />
        <Shell />
      </ConsoleProvider>
    </LiveProvider>
  );
}
