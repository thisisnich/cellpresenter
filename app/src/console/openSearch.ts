import type { DockviewApi } from "dockview-react";
import { t } from "../i18n";

export interface SearchParams {
  query?: string;
  /** Changes on every request, so the same words can be searched again. */
  asked?: number;
}

/** Show the Find songs panel and search for `query`. */
export function openSearch(api: DockviewApi, query: string): void {
  const params: SearchParams = { query, asked: Date.now() };
  const panel = api.getPanel("search");
  if (panel) {
    panel.api.updateParameters(params);
    panel.api.setActive();
    return;
  }
  const library = api.getPanel("library");
  api.addPanel<SearchParams>({
    id: "search",
    component: "search",
    title: t("panel.search"),
    params,
    ...(library ? { position: { referencePanel: library, direction: "within" as const } } : {}),
  });
}
