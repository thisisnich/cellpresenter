// Reconnect wrapper around the /ws live-state socket.
//
// Protocol (server → client):
//   on connect:  { "type": "snapshot", "state": LiveState }
//   on change:   { "type": "update",   "state": LiveState }
//
// Relative URL on purpose: in dev the Vite proxy forwards /ws to axum; in
// prod the SPA is served by axum itself, so location.host is always right.

import type { LiveState } from "../generated/LiveState";
import type { WsMsg } from "../generated/WsMsg";

export type { LiveState } from "../generated/LiveState";
export type { Slide } from "../generated/Slide";
export type { WsMsg } from "../generated/WsMsg";

export type ConnectionStatus = "connecting" | "open" | "closed";

export interface LiveOptions {
  onState: (state: LiveState) => void;
  onStatus?: (status: ConnectionStatus) => void;
}

// Retry quickly: a display that sits on "no signal" for long during a service
// is worse than a few extra connection attempts on a local network.
const RECONNECT_BASE_MS = 250;
const RECONNECT_MAX_MS = 2_000;

export function connectLive({ onState, onStatus }: LiveOptions): () => void {
  let disposed = false;
  let socket: WebSocket | null = null;
  let retry = 0;
  let timer: number | undefined;

  const scheduleReconnect = () => {
    if (disposed) return;
    window.clearTimeout(timer);
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** retry, RECONNECT_MAX_MS);
    retry += 1;
    timer = window.setTimeout(open, delay);
  };

  const open = () => {
    if (disposed) return;
    onStatus?.("connecting");
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;
    socket = new WebSocket(url);

    socket.onopen = () => {
      retry = 0;
      onStatus?.("open");
    };
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as WsMsg;
        if (msg.type === "snapshot" || msg.type === "update") {
          onState(msg.state);
        }
      } catch {
        // Malformed frame: ignore, the next snapshot resyncs.
      }
    };
    socket.onclose = () => {
      socket = null;
      onStatus?.("closed");
      scheduleReconnect();
    };
    socket.onerror = () => {
      socket?.close();
    };
  };

  // Open on the next tick, not synchronously. React's dev-mode double mount
  // disposes the first subscription immediately; deferring means that one
  // never opens a socket, instead of opening and instantly closing it (which
  // made the Vite proxy log EPIPE errors).
  timer = window.setTimeout(open, 0);

  // A phone waking up or a tab coming back shouldn't wait out the backoff.
  const retryNow = () => {
    if (disposed || socket || document.visibilityState === "hidden") return;
    window.clearTimeout(timer);
    retry = 0;
    open();
  };
  window.addEventListener("focus", retryNow);
  window.addEventListener("online", retryNow);
  document.addEventListener("visibilitychange", retryNow);

  return () => {
    disposed = true;
    if (timer !== undefined) window.clearTimeout(timer);
    window.removeEventListener("focus", retryNow);
    window.removeEventListener("online", retryNow);
    document.removeEventListener("visibilitychange", retryNow);
    socket?.close();
  };
}
