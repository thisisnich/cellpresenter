import type { DockviewApi } from "dockview-react";
import type { SongDraft } from "../domain/importing";
import { t } from "../i18n";

export interface EditorParams {
  songId: string | null;
  /** A new song to start from, e.g. one found online. */
  draft?: SongDraft;
}

/** Open (or focus) a song editor tab, next to the other editors. */
export function openEditor(api: DockviewApi, songId: string | null, title?: string, draft?: SongDraft): void {
  const id = songId ? `editor:${songId}` : `editor:new:${Date.now()}`;
  const existing = api.getPanel(id);
  if (existing) {
    existing.api.setActive();
    return;
  }
  const reference = api.panels.find((p) => p.id.startsWith("editor:")) ?? api.getPanel("start") ?? api.activePanel;
  api.addPanel<EditorParams>({
    id,
    component: "editor",
    title: songId || draft ? t("editor.tabTitle", { title: title ?? draft?.title ?? "" }) : t("editor.newTitle"),
    params: draft ? { songId, draft } : { songId },
    ...(reference ? { position: { referencePanel: reference, direction: "within" as const } } : {}),
  });
}
