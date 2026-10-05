import type { DockviewApi } from "dockview-react";
import { t } from "../i18n";

export interface EditorParams {
  songId: string | null;
}

/** Open (or focus) a song editor tab next to the Slides panel. */
export function openEditor(api: DockviewApi, songId: string | null, title?: string): void {
  const id = songId ? `editor:${songId}` : `editor:new:${Date.now()}`;
  const existing = api.getPanel(id);
  if (existing) {
    existing.api.setActive();
    return;
  }
  const reference = api.getPanel("slides");
  api.addPanel<EditorParams>({
    id,
    component: "editor",
    title: songId ? t("editor.tabTitle", { title: title ?? "" }) : t("editor.newTitle"),
    params: { songId },
    ...(reference ? { position: { referencePanel: reference, direction: "within" as const } } : {}),
  });
}
