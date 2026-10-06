import { DockviewReact, type DockviewApi, type DockviewTheme } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { useMemo } from "react";
import type { Theme } from "../theme/tokens";
import { restoreLayout, saveLayout } from "./layout";
import { EditorPanel } from "./panels/EditorPanel";
import { LibraryPanel } from "./panels/LibraryPanel";
import { MediaPanel } from "./panels/MediaPanel";
import { OutputPanel } from "./panels/OutputPanel";
import { PlaceholderPanel } from "./panels/PlaceholderPanel";
import { SetlistPanel } from "./panels/SetlistPanel";
import { SlidesPanel } from "./panels/SlidesPanel";

const components = {
  setlist: SetlistPanel,
  library: LibraryPanel,
  editor: EditorPanel,
  media: MediaPanel,
  slides: SlidesPanel,
  output: OutputPanel,
  placeholder: PlaceholderPanel,
};

// The dockable workspace. Panels are plain components; the layout is
// restored on start and saved whenever the operator rearranges it.
export function Workspace({ theme, onReady }: { theme: Theme; onReady: (api: DockviewApi) => void }) {
  const dockTheme = useMemo<DockviewTheme>(
    () => ({
      name: "cellpresenter",
      className: "dockview-theme-cp",
      colorScheme: theme.scheme,
      gap: theme.panelGap,
    }),
    [theme.scheme, theme.panelGap],
  );

  return (
    <DockviewReact
      className="h-full"
      theme={dockTheme}
      components={components}
      onReady={({ api }) => {
        restoreLayout(api);
        let timer: number | undefined;
        api.onDidLayoutChange(() => {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => saveLayout(api), 400);
        });
        onReady(api);
      }}
    />
  );
}
