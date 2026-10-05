// The ONLY module that talks to the server (see layering rule in the spec).
// Relative URLs everywhere: in dev the Vite proxy forwards /api, /ws, /media,
// /native to the embedded axum server; in prod axum serves this SPA itself,
// so same-origin holds in both worlds.
import type { LiveState } from "./ws";

export interface Health {
  status: string;
  version: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/** Every change to live state. Mirrors `Command` in src-tauri/src/live.rs. */
export type LiveCommand =
  | { type: "next" }
  | { type: "prev" }
  | { type: "go_to"; index: number }
  | { type: "toggle_visible" }
  | { type: "set_visible"; visible: boolean }
  | { type: "set_text_scale"; scale: number };

export const api = {
  health: () => request<Health>("/api/health"),
  liveState: () => request<LiveState>("/api/live/state"),
  liveCommand: (command: LiveCommand) =>
    request<LiveState>("/api/live/command", {
      method: "POST",
      body: JSON.stringify(command),
    }),
};
