use std::net::{Ipv4Addr, SocketAddr};
use std::sync::{Arc, RwLock};

use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
        State,
    },
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use tauri::{AssetResolver, Wry};
use tokio::net::TcpListener;
use tokio::sync::broadcast;

use crate::live::{Command, LiveState};

/// Preferred port. The Vite dev proxy targets it, so dev builds use it only.
pub const DEFAULT_PORT: u16 = 9100;
/// Release builds try this many ports from DEFAULT_PORT before asking the OS.
const PORT_ATTEMPTS: u16 = 10;

/// Messages pushed over /ws. A client gets one `snapshot` on connect, then
/// `update`s as state changes.
#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsMsg {
    Snapshot { state: LiveState },
    Update { state: LiveState },
}

#[derive(Clone)]
pub struct ServerState {
    live: Arc<RwLock<LiveState>>,
    tx: broadcast::Sender<WsMsg>,
    assets: Arc<AssetResolver<Wry>>,
}

impl ServerState {
    pub fn new(assets: AssetResolver<Wry>) -> Self {
        let (tx, _) = broadcast::channel(64);
        Self {
            live: Arc::new(RwLock::new(LiveState::default())),
            tx,
            assets: Arc::new(assets),
        }
    }

    fn snapshot(&self) -> LiveState {
        self.live.read().unwrap().clone()
    }

    /// Apply one change to the live state and broadcast the result.
    fn mutate(&self, change: impl FnOnce(&mut LiveState)) -> LiveState {
        let state = {
            let mut live = self.live.write().unwrap();
            change(&mut live);
            live.clone()
        };
        let _ = self.tx.send(WsMsg::Update {
            state: state.clone(),
        });
        state
    }
}

// ---------- port binding ----------

/// Ports to try, in order. Port 0 lets the OS pick a free one.
fn candidate_ports(strict: bool) -> Vec<u16> {
    if strict {
        vec![DEFAULT_PORT]
    } else {
        (DEFAULT_PORT..DEFAULT_PORT + PORT_ATTEMPTS)
            .chain(std::iter::once(0))
            .collect()
    }
}

/// Bind the embedded server on all interfaces so phones on the LAN can reach
/// it. Dev builds insist on DEFAULT_PORT because the Vite proxy points there.
pub async fn bind() -> Result<TcpListener, String> {
    let strict = cfg!(debug_assertions);
    let mut last_err = None;
    for port in candidate_ports(strict) {
        match TcpListener::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, port))).await {
            Ok(listener) => return Ok(listener),
            Err(e) => last_err = Some((port, e)),
        }
    }
    let (port, e) = last_err.expect("at least one candidate port");
    Err(if strict {
        format!(
            "Port {port} is in use ({e}). Close the other CellPresenter (or whatever uses \
             port {port}) and run `npm run tauri dev` again."
        )
    } else {
        format!("Could not open a network port for CellPresenter ({e}).")
    })
}

// ---------- REST ----------

#[derive(Serialize)]
struct Health {
    status: &'static str,
    version: &'static str,
}

async fn health() -> Json<Health> {
    Json(Health {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn live_state(State(s): State<ServerState>) -> Json<LiveState> {
    Json(s.snapshot())
}

/// Apply one live command and return the new state. Every client — console,
/// phone remote, later the cloud live room — changes live state this way.
async fn live_command(
    State(s): State<ServerState>,
    Json(command): Json<Command>,
) -> Json<LiveState> {
    Json(s.mutate(|l| l.apply(command)))
}

// ---------- WebSocket ----------

async fn ws_handler(ws: WebSocketUpgrade, State(s): State<ServerState>) -> Response {
    ws.on_upgrade(move |socket| websocket_loop(socket, s))
}

async fn websocket_loop(mut socket: WebSocket, s: ServerState) {
    // Subscribe before taking the snapshot so no update can slip in between.
    let mut rx = s.tx.subscribe();
    if send(
        &mut socket,
        &WsMsg::Snapshot {
            state: s.snapshot(),
        },
    )
    .await
    .is_err()
    {
        return;
    }
    loop {
        match rx.recv().await {
            Ok(msg) => {
                if send(&mut socket, &msg).await.is_err() {
                    break;
                }
            }
            Err(broadcast::error::RecvError::Lagged(_)) => {
                // Slow consumer: resync from a fresh snapshot rather than
                // replaying everything it missed.
                if send(
                    &mut socket,
                    &WsMsg::Snapshot {
                        state: s.snapshot(),
                    },
                )
                .await
                .is_err()
                {
                    break;
                }
            }
            Err(broadcast::error::RecvError::Closed) => break,
        }
    }
}

async fn send(socket: &mut WebSocket, msg: &WsMsg) -> Result<(), axum::Error> {
    let text = serde_json::to_string(msg).expect("serialize ws message");
    socket.send(WsMessage::Text(text.into())).await
}

// ---------- SPA ----------

/// Serve the web app from the assets Tauri bundled into the binary (in dev,
/// Tauri reads them from `dist/` instead). Unknown paths get index.html so
/// client-side routes like /display work on a hard refresh.
async fn spa(State(s): State<ServerState>, uri: Uri) -> Response {
    let path = uri.path();
    let is_hashed_asset = path.starts_with("/assets/");
    // The bundled lookup already falls back to index.html; the dev lookup
    // reads files straight from dist/ and doesn't, so fall back here too.
    let found = s.assets.get(path.to_string()).or_else(|| {
        (!is_hashed_asset)
            .then(|| s.assets.get("index.html".to_string()))
            .flatten()
    });
    let Some(asset) = found else {
        if is_hashed_asset {
            return StatusCode::NOT_FOUND.into_response();
        }
        return (
            StatusCode::NOT_FOUND,
            "The web app isn't built yet. Run `npm run build` and reload.",
        )
            .into_response();
    };
    // A missing hashed asset falls back to index.html; report it as missing
    // instead so a stale page fails loudly rather than parsing HTML as JS.
    if is_hashed_asset && asset.mime_type().starts_with("text/html") {
        return StatusCode::NOT_FOUND.into_response();
    }
    // Vite content-hashes everything under /assets, so those can be cached
    // forever. The HTML shell must always be revalidated, or phones keep an
    // old bundle after an update.
    let cache = if is_hashed_asset {
        "public, max-age=31536000, immutable"
    } else {
        "no-cache"
    };
    (
        [
            (header::CONTENT_TYPE, asset.mime_type().to_string()),
            (header::CACHE_CONTROL, cache.to_string()),
        ],
        asset.bytes,
    )
        .into_response()
}

// ---------- router ----------

pub fn router(state: ServerState) -> Router {
    let api = Router::new()
        .route("/health", get(health))
        .route("/live/state", get(live_state))
        .route("/live/command", post(live_command))
        .fallback(|| async { StatusCode::NOT_FOUND });
    Router::new()
        .nest("/api", api)
        .route("/ws", get(ws_handler))
        .fallback(spa)
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strict_mode_only_tries_default_port() {
        assert_eq!(candidate_ports(true), vec![DEFAULT_PORT]);
    }

    #[test]
    fn relaxed_mode_falls_back_then_asks_os() {
        let ports = candidate_ports(false);
        assert_eq!(ports.first(), Some(&DEFAULT_PORT));
        assert_eq!(ports.len(), PORT_ATTEMPTS as usize + 1);
        assert_eq!(ports.last(), Some(&0));
    }
}
