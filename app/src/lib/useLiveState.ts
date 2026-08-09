import { useCallback, useEffect, useState } from "react";
import { connectLive, type ConnectionStatus, type LiveState } from "./ws";

// Subscribes to the live presentation state over /ws.
// `patch` lets controls optimistically apply the response they just got from a
// REST mutation; the next WS update/snapshot reconciles anything stale.
export function useLiveState() {
  const [state, setState] = useState<LiveState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  const patch = useCallback((next: LiveState) => setState(next), []);

  useEffect(
    () =>
      connectLive({
        onState: patch,
        onStatus: setStatus,
      }),
    [patch],
  );

  return { state, patch, status };
}
