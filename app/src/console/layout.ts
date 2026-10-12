import type { DockviewApi } from "dockview-react";
import { t } from "../i18n";

import type { Page } from "./pages";

// Each console page has its own default layout. Operators can rearrange a
// page; the result is saved per machine and per page, and Reset brings the
// default back.
//   Show:   setlist + library | slides (notes) | output (stage, media)
//   Edit:   library | song editors | media
//   Chords: setlist | chords | output

// Bump the version when panels change, so old saved layouts are dropped.
const storageKey = (page: Page) => `cellpresenter.layout.v6.${page}`;

export function buildDefaultLayout(api: DockviewApi, page: Page): void {
  api.clear();
  if (page === "show") buildShow(api);
  else if (page === "edit") buildEdit(api);
  else buildChords(api);
}

function buildShow(api: DockviewApi): void {
  api.addPanel({ id: "slides", component: "slides", title: t("panel.slides") });
  api.addPanel({
    id: "notes",
    component: "placeholder",
    title: t("panel.notes"),
    params: { message: "notes.comingSoon" },
    position: { referencePanel: "slides", direction: "within" },
    inactive: true,
  });
  api.addPanel({
    id: "setlist",
    component: "setlist",
    title: t("panel.setlist"),
    position: { referencePanel: "slides", direction: "left" },
    initialWidth: 260,
  });
  api.addPanel({
    id: "library",
    component: "library",
    title: t("panel.library"),
    position: { referencePanel: "setlist", direction: "below" },
  });
  api.addPanel({
    id: "output",
    component: "output",
    title: t("panel.output"),
    position: { referencePanel: "slides", direction: "right" },
    initialWidth: 320,
  });
  api.addPanel({
    id: "stage",
    component: "placeholder",
    title: t("panel.stage"),
    params: { message: "stage.comingSoon" },
    position: { referencePanel: "output", direction: "within" },
    inactive: true,
  });
  api.addPanel({
    id: "media",
    component: "media",
    title: t("panel.media"),
    position: { referencePanel: "output", direction: "within" },
    inactive: true,
  });
  api.getPanel("slides")?.api.setActive();
}

function buildEdit(api: DockviewApi): void {
  api.addPanel({
    id: "start",
    component: "placeholder",
    title: t("panel.start"),
    params: { message: "edit.start" },
  });
  api.addPanel({
    id: "library",
    component: "library",
    title: t("panel.library"),
    position: { referencePanel: "start", direction: "left" },
    initialWidth: 280,
  });
  api.addPanel({
    id: "media",
    component: "media",
    title: t("panel.media"),
    position: { referencePanel: "start", direction: "right" },
    initialWidth: 300,
  });
}

function buildChords(api: DockviewApi): void {
  api.addPanel({ id: "chords", component: "chords", title: t("panel.chords") });
  api.addPanel({
    id: "setlist",
    component: "setlist",
    title: t("panel.setlist"),
    position: { referencePanel: "chords", direction: "left" },
    initialWidth: 260,
  });
  api.addPanel({
    id: "output",
    component: "output",
    title: t("panel.output"),
    position: { referencePanel: "chords", direction: "right" },
    initialWidth: 300,
  });
}

// Panels the Layout menu can add. Any of them can be open more than once
// (two Chords tabs, say); the first copy keeps the plain id.
export const PANEL_KINDS = ["slides", "chords", "setlist", "library", "output", "media", "notes", "stage"] as const;
export type PanelKind = (typeof PANEL_KINDS)[number];

const PLACEHOLDERS: Partial<Record<PanelKind, string>> = { notes: "notes.comingSoon", stage: "stage.comingSoon" };

/** The kind of panel an id belongs to: "chords:2" → "chords". */
export const kindOf = (id: string | null | undefined): string | null => id?.split(":")[0] ?? null;

/** Add a panel as a new tab in the group the operator is using. */
export function addPanel(api: DockviewApi, kind: PanelKind): void {
  let id: string = kind;
  for (let n = 2; api.getPanel(id); n++) id = `${kind}:${n}`;
  const message = PLACEHOLDERS[kind];
  const group = api.activeGroup;
  api.addPanel({
    id,
    component: message ? "placeholder" : kind,
    title: t(`panel.${kind}`),
    ...(message ? { params: { message } } : {}),
    ...(group ? { position: { referenceGroup: group, direction: "within" as const } } : {}),
  });
}

/** Restore the saved layout, falling back to the default. */
export function restoreLayout(api: DockviewApi, page: Page): void {
  try {
    const saved = localStorage.getItem(storageKey(page));
    if (saved) {
      api.fromJSON(JSON.parse(saved));
      return;
    }
  } catch {
    // Unreadable or incompatible layout: start fresh below.
  }
  buildDefaultLayout(api, page);
}

export function saveLayout(api: DockviewApi, page: Page): void {
  try {
    localStorage.setItem(storageKey(page), JSON.stringify(api.toJSON()));
  } catch {
    // Storage full or blocked: the layout just won't persist.
  }
}

export function resetLayout(api: DockviewApi, page: Page): void {
  try {
    localStorage.removeItem(storageKey(page));
  } catch {
    // Ignore; the default layout is rebuilt either way.
  }
  buildDefaultLayout(api, page);
}
