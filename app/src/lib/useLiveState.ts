import { useCallback, useEffect, useState } from "react";
import { isNewer } from "./liveVersion";
import { connectLive, type ConnectionStatus, type LiveState } from "./ws";

// Subscribes to the live presentation state over /ws.
// `patch` lets controls apply the response they just got from a command
// straight away. Every state carries a version, so whichever of the response
// and the WS update arrives late is ignored instead of undoing the newer one.
export function useLiveState() {
  const [state, setState] = useState<LiveState | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  const patch = useCallback(
    (next: LiveState) => setState((current) => (isNewer(current, next) ? next : current)),
    [],
  );

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
