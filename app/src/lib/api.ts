// The ONLY module that talks to the server over HTTP (see the layering rule
// in the spec). Relative URLs everywhere: in dev the Vite proxy forwards /api
// and /ws to the embedded server; in prod that server serves this app itself,
// so same-origin holds in both worlds.
import type { Command } from "../generated/Command";
import type { LiveState } from "../generated/LiveState";
import type { NetworkInfo } from "../generated/NetworkInfo";
import type { PinInfo } from "../generated/PinInfo";
import type { Setlist } from "../generated/Setlist";
import type { SetlistInput } from "../generated/SetlistInput";
import type { SetlistSummary } from "../generated/SetlistSummary";
import type { ShowItem } from "../generated/ShowItem";
import type { ShowSong } from "../generated/ShowSong";
import type { Song } from "../generated/Song";
import type { SongInput } from "../generated/SongInput";
import type { SongSummary } from "../generated/SongSummary";

export type LiveCommand = Command;

export interface Health {
  status: string;
  version: string;
}

/** A failed request. `code` is the server's reason, e.g. "pin_required". */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code || `HTTP ${status}`);
  }
}

// The control PIN, for devices other than the laptop running the app.
// The laptop itself never needs one.
const PIN_STORAGE_KEY = "cellpresenter.pin";
let controlPin: string | null = (() => {
  try {
    return sessionStorage.getItem(PIN_STORAGE_KEY);
  } catch {
    return null;
  }
})();

export function setControlPin(pin: string | null): void {
  controlPin = pin;
  try {
    if (pin) sessionStorage.setItem(PIN_STORAGE_KEY, pin);
    else sessionStorage.removeItem(PIN_STORAGE_KEY);
  } catch {
    // Storage blocked: the PIN lasts until the page reloads.
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (controlPin) headers["X-CP-Pin"] = controlPin;
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let code = "";
    try {
      code = ((await res.json()) as { error?: string }).error ?? "";
    } catch {
      // Not JSON: keep the status only.
    }
    throw new ApiError(res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  health: () => request<Health>("/api/health"),
  pin: () => request<PinInfo>("/api/pin"),
  network: () => request<NetworkInfo>("/api/network"),

  liveState: () => request<LiveState>("/api/live/state"),
  liveCommand: (command: LiveCommand) => request<LiveState>("/api/live/command", json("POST", command)),
  showSong: (args: ShowSong) => request<LiveState>("/api/live/show-song", json("POST", args)),
  showItem: (args: ShowItem) => request<LiveState>("/api/live/show-item", json("POST", args)),

  listSongs: () => request<SongSummary[]>("/api/songs"),
  getSong: (id: string) => request<Song>(`/api/songs/${encodeURIComponent(id)}`),
  createSong: (input: SongInput) => request<Song>("/api/songs", json("POST", input)),
  updateSong: (id: string, input: SongInput) =>
    request<Song>(`/api/songs/${encodeURIComponent(id)}`, json("PUT", input)),
  deleteSong: (id: string) => request<void>(`/api/songs/${encodeURIComponent(id)}`, { method: "DELETE" }),

  listSetlists: () => request<SetlistSummary[]>("/api/setlists"),
  getSetlist: (id: string) => request<Setlist>(`/api/setlists/${encodeURIComponent(id)}`),
  createSetlist: (input: SetlistInput) => request<Setlist>("/api/setlists", json("POST", input)),
  updateSetlist: (id: string, input: SetlistInput) =>
    request<Setlist>(`/api/setlists/${encodeURIComponent(id)}`, json("PUT", input)),
  deleteSetlist: (id: string) => request<void>(`/api/setlists/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
