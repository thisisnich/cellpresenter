// Reconnect wrapper around the /ws live-state socket.
//
// Protocol (server → client):
//   on connect:  { "type": "snapshot", "state": LiveState }
//   on change:   { "type": "update",   "state": LiveState }
//
// Relative URL on purpose: in dev the Vite proxy forwards /ws to axum; in
// prod the SPA is served by axum itself, so location.host is always right.

export interface LiveState {
  slide_index: number;
  slides: string[];
  visible: boolean;
  text_scale: number;
}

export type WsMsg =
  | { type: "snapshot"; state: LiveState }
  | { type: "update"; state: LiveState };

export type ConnectionStatus = "connecting" | "open" | "closed";

export interface LiveOptions {
  onState: (state: LiveState) => void;
  onStatus?: (status: ConnectionStatus) => void;
}

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10_000;

export function connectLive({ onState, onStatus }: LiveOptions): () => void {
  let disposed = false;
  let socket: WebSocket | null = null;
  let retry = 0;
  let timer: number | undefined;

  const scheduleReconnect = () => {
    if (disposed) return;
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
      onStatus?.("closed");
      scheduleReconnect();
    };
    socket.onerror = () => {
      socket?.close();
    };
  };

  open();

  return () => {
    disposed = true;
    if (timer !== undefined) window.clearTimeout(timer);
    socket?.close();
  };
}
