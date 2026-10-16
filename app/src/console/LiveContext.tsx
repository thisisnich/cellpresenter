import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, type LiveCommand } from "../lib/api";
import { useLiveState } from "../lib/useLiveState";
import type { ConnectionStatus, LiveState } from "../lib/ws";

interface LiveContextValue {
  state: LiveState | null;
  status: ConnectionStatus;
  /** Last command error, cleared by the next successful command. */
  error: string | null;
  send: (command: LiveCommand) => Promise<void>;
  /** Put a library song on air. */
  showSong: (songId: string, slideIndex?: number, title?: boolean) => Promise<void>;
  /** Put a setlist item on air. */
  showItem: (setlistId: string, itemId: string, slideIndex?: number, title?: boolean) => Promise<void>;
  /** Put an image on the background layer now (null clears it). */
  setBackground: (mediaId: string | null) => Promise<void>;
}

const LiveContext = createContext<LiveContextValue | null>(null);

// One live-state subscription for the whole console. Dockview renders panels
// through portals, so every panel shares this context.
export function LiveProvider({ children }: { children: ReactNode }) {
  const { state, patch, status } = useLiveState();
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (call: () => Promise<LiveState>) => {
      try {
        patch(await call());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [patch],
  );
  const send = useCallback((command: LiveCommand) => run(() => api.liveCommand(command)), [run]);
  const showSong = useCallback(
    // `title`: start on the song's title slide (when the look has one).
    (songId: string, slideIndex = 0, title = false) => run(() => api.showSong({ song_id: songId, slide_index: slideIndex, title })),
    [run],
  );

  const showItem = useCallback(
    (setlistId: string, itemId: string, slideIndex = 0, title = false) =>
      run(() => api.showItem({ setlist_id: setlistId, item_id: itemId, slide_index: slideIndex, title })),
    [run],
  );

  const setBackground = useCallback((mediaId: string | null) => run(() => api.liveBackground(mediaId)), [run]);

  const value = useMemo(
    () => ({ state, status, error, send, showSong, showItem, setBackground }),
    [state, status, error, send, showSong, showItem, setBackground],
  );
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveContextValue {
  const value = useContext(LiveContext);
  if (!value) throw new Error("useLive must be used inside <LiveProvider>");
  return value;
}

/** Index of the slide after the live one within the same item, if any. */
export function nextIndex(state: LiveState): number | null {
  // From the title slide, the song's first slide is next.
  if (state.title_card) return state.slides.length > 0 ? 0 : null;
  return state.slide_index + 1 < state.slides.length ? state.slide_index + 1 : null;
}
