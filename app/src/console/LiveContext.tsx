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
}

const LiveContext = createContext<LiveContextValue | null>(null);

// One live-state subscription for the whole console. Dockview renders panels
// through portals, so every panel shares this context.
export function LiveProvider({ children }: { children: ReactNode }) {
  const { state, patch, status } = useLiveState();
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (command: LiveCommand) => {
      try {
        patch(await api.liveCommand(command));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [patch],
  );

  const value = useMemo(() => ({ state, status, error, send }), [state, status, error, send]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveContextValue {
  const value = useContext(LiveContext);
  if (!value) throw new Error("useLive must be used inside <LiveProvider>");
  return value;
}

/** Index of the slide after the live one (wraps, matching the Next command). */
export function nextIndex(state: LiveState): number | null {
  const n = state.slides.length;
  return n > 1 ? (state.slide_index + 1) % n : null;
}
