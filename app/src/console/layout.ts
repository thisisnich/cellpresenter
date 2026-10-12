import type { DockviewApi } from "dockview-react";
import { t } from "../i18n";

// The default workspace (design A1 "Slide Grid"): setlist on the left, slides
// in the centre, output on the right. Operators can rearrange it; the result
// is saved per machine and "Reset layout" brings this back.

// Bump the version when panels change, so old saved layouts are dropped.
const STORAGE_KEY = "cellpresenter.layout.v5";

export function buildDefaultLayout(api: DockviewApi): void {
  api.clear();
  api.addPanel({ id: "slides", component: "slides", title: t("panel.slides") });
  api.addPanel({
    id: "chords",
    component: "chords",
    title: t("panel.chords"),
    position: { referencePanel: "slides", direction: "within" },
    inactive: true,
  });
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

/** Bring a panel to the front, re-adding it if it was closed. */
export function focusPanel(api: DockviewApi, id: "slides" | "chords"): void {
  const panel = api.getPanel(id);
  if (panel) {
    panel.api.setActive();
    return;
  }
  const other = api.getPanel(id === "slides" ? "chords" : "slides");
  api.addPanel({
    id,
    component: id,
    title: t(id === "slides" ? "panel.slides" : "panel.chords"),
    ...(other ? { position: { referencePanel: other, direction: "within" as const } } : {}),
  });
}

/** Restore the saved layout, falling back to the default. */
export function restoreLayout(api: DockviewApi): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      api.fromJSON(JSON.parse(saved));
      return;
    }
  } catch {
    // Unreadable or incompatible layout: start fresh below.
  }
  buildDefaultLayout(api);
}

export function saveLayout(api: DockviewApi): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(api.toJSON()));
  } catch {
    // Storage full or blocked: the layout just won't persist.
  }
}

export function resetLayout(api: DockviewApi): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore; the default layout is rebuilt either way.
  }
  buildDefaultLayout(api);
}
