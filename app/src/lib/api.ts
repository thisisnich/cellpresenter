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

export const api = {
  health: () => request<Health>("/api/health"),
  liveState: () => request<LiveState>("/api/live/state"),
  liveNext: () => request<LiveState>("/api/live/next", { method: "POST" }),
  livePrev: () => request<LiveState>("/api/live/prev", { method: "POST" }),
  liveGoTo: (index: number) =>
    request<LiveState>("/api/live/go-to", {
      method: "POST",
      body: JSON.stringify({ index }),
    }),
  liveToggleVisible: () =>
    request<LiveState>("/api/live/toggle-visible", { method: "POST" }),
};
