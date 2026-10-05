import type { DockviewApi } from "dockview-react";
import { useRef } from "react";
import { DEFAULT_THEME } from "../theme/tokens";
import { Header } from "./Header";
import { resetLayout } from "./layout";
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

// Operator console: header, dockable workspace, transport bar.
export default function ConsoleApp() {
  const dock = useRef<DockviewApi | null>(null);
  return (
    <LiveProvider>
      <ConsoleProvider>
        <TransportKeys />
        <div className="flex h-screen flex-col bg-cp-bg font-ui text-cp-text">
          <Header onResetLayout={() => dock.current && resetLayout(dock.current)} />
          <div className="min-h-0 flex-1">
            <Workspace theme={DEFAULT_THEME} onReady={(api) => (dock.current = api)} />
          </div>
          <TransportBar />
        </div>
      </ConsoleProvider>
    </LiveProvider>
  );
}
