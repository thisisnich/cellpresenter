// The ONLY module that talks to the server over HTTP (see the layering rule
// in the spec). Relative URLs everywhere: in dev the Vite proxy forwards /api
// and /ws to the embedded server; in prod that server serves this app itself,
// so same-origin holds in both worlds.
import type { BackupInfo } from "../generated/BackupInfo";
import type { BackupList } from "../generated/BackupList";
import type { Command } from "../generated/Command";
import type { LiveState } from "../generated/LiveState";
import type { Look } from "../generated/Look";
import type { Media } from "../generated/Media";
import type { NetworkInfo } from "../generated/NetworkInfo";
import type { OnlineSong } from "../generated/OnlineSong";
import type { PinInfo } from "../generated/PinInfo";
import type { RestoredCounts } from "../generated/RestoredCounts";
import type { Screens } from "../generated/Screens";
import type { SearchHit } from "../generated/SearchHit";
import type { Setlist } from "../generated/Setlist";
import type { SetlistInput } from "../generated/SetlistInput";
import type { SetlistSummary } from "../generated/SetlistSummary";
import type { ShowItem } from "../generated/ShowItem";
import type { ShowSong } from "../generated/ShowSong";
import type { Song } from "../generated/Song";
import type { SongInput } from "../generated/SongInput";
import type { SongSummary } from "../generated/SongSummary";
import type { Source } from "../generated/Source";

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

export function controlPinSet(): boolean {
  return controlPin !== null;
}

export function setControlPin(pin: string | null): void {
  controlPin = pin;
  try {
    if (pin) sessionStorage.setItem(PIN_STORAGE_KEY, pin);
    else sessionStorage.removeItem(PIN_STORAGE_KEY);
  } catch {
    // Storage blocked: the PIN lasts until the page reloads.
  }
}

async function request<T>(path: string, init?: RequestInit, contentType = "application/json"): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": contentType };
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
  /** Resolves if this device may control slides (PIN accepted or local). */
  checkControl: () => request<void>("/api/control/check"),

  screens: () => request<Screens>("/api/screens"),
  showDisplayOn: (screen: number | null) => request<Screens>("/api/screens/output", json("POST", { screen })),
  /** The Display window's F key: fullscreen where it is, or back to a window. */
  toggleFullscreen: () => request<Screens>("/api/screens/toggle-fullscreen", { method: "POST" }),

  liveState: () => request<LiveState>("/api/live/state"),
  /** Change how every screen looks (copyright line, …). */
  setLook: (look: Look) => request<LiveState>("/api/look", json("PUT", look)),
  liveCommand: (command: LiveCommand) => request<LiveState>("/api/live/command", json("POST", command)),
  showSong: (args: ShowSong) => request<LiveState>("/api/live/show-song", json("POST", args)),
  showItem: (args: ShowItem) => request<LiveState>("/api/live/show-item", json("POST", args)),

  listSongs: () => request<SongSummary[]>("/api/songs"),
  getSong: (id: string) => request<Song>(`/api/songs/${encodeURIComponent(id)}`),
  createSong: (input: SongInput) => request<Song>("/api/songs", json("POST", input)),
  updateSong: (id: string, input: SongInput) =>
    request<Song>(`/api/songs/${encodeURIComponent(id)}`, json("PUT", input)),
  deleteSong: (id: string) => request<void>(`/api/songs/${encodeURIComponent(id)}`, { method: "DELETE" }),

  /** Search for lyrics (LRCLIB) through the server. */
  searchLyrics: (query: string) => request<SearchHit[]>(`/api/online/search?q=${encodeURIComponent(query)}`),
  /** Open Ultimate Guitar's search in this computer's browser (the computer only). */
  openUgSearch: (query: string) => request<void>("/api/online/open-ug-search", json("POST", { q: query })),
  onlineSong: (source: Source, id: string) =>
    request<OnlineSong>(`/api/online/song?source=${source}&id=${encodeURIComponent(id)}`),

  listBackups: () => request<BackupList>("/api/backups"),
  createBackup: () => request<BackupInfo>("/api/backups", { method: "POST" }),
  restoreBackup: (name: string) =>
    request<RestoredCounts>(`/api/backups/${encodeURIComponent(name)}/restore`, { method: "POST" }),
  /** Restore a backup file picked on this device. */
  restoreBackupFile: (file: File) =>
    request<RestoredCounts>("/api/backups/restore", { method: "POST", body: file }, "application/octet-stream"),
  /** Show the backups folder in the file manager (this computer only). */
  openBackupFolder: () => request<void>("/api/backups/open-folder", { method: "POST" }),

  listMedia: () => request<Media[]>("/api/media"),
  /** Upload an image file; big photos are scaled down on the server. */
  uploadMedia: (file: File) =>
    request<Media>(
      `/api/media?name=${encodeURIComponent(file.name)}`,
      { method: "POST", body: file },
      file.type || "application/octet-stream",
    ),
  deleteMedia: (id: string) => request<void>(`/api/media/${encodeURIComponent(id)}`, { method: "DELETE" }),
  /** Put an image on the background layer now (null clears it). */
  liveBackground: (mediaId: string | null) => request<LiveState>("/api/live/background", json("POST", { media_id: mediaId })),
  /** Attach a background cue to one slide of a song (null removes it). */
  setSlideBackground: (songId: string, slideId: string, mediaId: string | null) =>
    request<Song>(
      `/api/songs/${encodeURIComponent(songId)}/slides/${encodeURIComponent(slideId)}/background`,
      json("PUT", { media_id: mediaId }),
    ),

  setSectionBackground: (songId: string, sectionId: string, mediaId: string | null) =>
    request<Song>(
      `/api/songs/${encodeURIComponent(songId)}/sections/${encodeURIComponent(sectionId)}/background`,
      json("PUT", { media_id: mediaId }),
    ),

  listSetlists: () => request<SetlistSummary[]>("/api/setlists"),
  getSetlist: (id: string) => request<Setlist>(`/api/setlists/${encodeURIComponent(id)}`),
  createSetlist: (input: SetlistInput) => request<Setlist>("/api/setlists", json("POST", input)),
  updateSetlist: (id: string, input: SetlistInput) =>
    request<Setlist>(`/api/setlists/${encodeURIComponent(id)}`, json("PUT", input)),
  deleteSetlist: (id: string) => request<void>(`/api/setlists/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
