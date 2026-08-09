use std::sync::{Arc, RwLock};

use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tauri::{WebviewUrl, WebviewWindowBuilder};
use tokio::sync::broadcast;
use tower_http::services::{ServeDir, ServeFile};

pub const DEFAULT_PORT: u16 = 9100;
const DEV_WEBVIEW_URL: &str = "http://localhost:5173";

// ---------- live presentation state ----------

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LiveState {
    /// Index of the currently shown slide within `slides`.
    pub slide_index: usize,
    /// Demo presentation. M2 replaces this with a real setlist/song lookup.
    pub slides: Vec<String>,
    /// Black-out toggle: display clients render nothing when false.
    pub visible: bool,
}

impl Default for LiveState {
    fn default() -> Self {
        Self {
            slide_index: 0,
            slides: vec![
                "Amazing Grace".into(),
                "Verse 1 — Amazing grace, how sweet the sound…".into(),
                "Chorus — Amazing grace! how sweet the sound".into(),
                "Verse 2 — 'Twas grace that taught my heart to fear…".into(),
            ],
            visible: true,
        }
    }
}

/// Messages pushed over /ws. A client gets one `snapshot` on connect, then
/// `update`s as state changes. Deltas replace this once state grows past a
/// single struct (M2+).
#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsMsg {
    Snapshot { state: LiveState },
    Update { state: LiveState },
}

// ---------- shared server state ----------

#[derive(Clone)]
pub struct ServerState {
    live: Arc<RwLock<LiveState>>,
    tx: broadcast::Sender<WsMsg>,
}

fn publish(s: &ServerState, state: LiveState) {
    let _ = s.tx.send(WsMsg::Update { state });
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
    Json(s.live.read().unwrap().clone())
}

async fn live_next(State(s): State<ServerState>) -> Json<LiveState> {
    step(&s, 1)
}

async fn live_prev(State(s): State<ServerState>) -> Json<LiveState> {
    step(&s, -1)
}

fn step(s: &ServerState, delta: isize) -> Json<LiveState> {
    let mut live = s.live.write().unwrap();
    let n = live.slides.len();
    if n > 0 {
        live.slide_index = (live.slide_index as isize + delta).rem_euclid(n as isize) as usize;
    }
    let state = live.clone();
    drop(live);
    publish(s, state.clone());
    Json(state)
}

#[derive(Deserialize)]
struct GoToArgs {
    index: usize,
}

async fn live_go_to(
    State(s): State<ServerState>,
    Json(args): Json<GoToArgs>,
) -> Json<LiveState> {
    let mut live = s.live.write().unwrap();
    if args.index < live.slides.len() {
        live.slide_index = args.index;
    }
    let state = live.clone();
    drop(live);
    publish(&s, state.clone());
    Json(state)
}

async fn live_toggle_visible(State(s): State<ServerState>) -> Json<LiveState> {
    let mut live = s.live.write().unwrap();
    live.visible = !live.visible;
    let state = live.clone();
    drop(live);
    publish(&s, state.clone());
    Json(state)
}

// ---------- WebSocket ----------

async fn ws_handler(ws: WebSocketUpgrade, State(s): State<ServerState>) -> Response {
    ws.on_upgrade(move |socket| websocket_loop(socket, s))
}

async fn websocket_loop(mut socket: WebSocket, s: ServerState) {
    // New clients start from a full snapshot so they never miss current state.
    let snapshot = s.live.read().unwrap().clone();
    if send(&mut socket, &WsMsg::Snapshot { state: snapshot })
        .await
        .is_err()
    {
        return;
    }

    let mut rx = s.tx.subscribe();
    loop {
        match rx.recv().await {
            Ok(WsMsg::Update { state }) => {
                if send(&mut socket, &WsMsg::Update { state }).await.is_err() {
                    break;
                }
            }
            Ok(WsMsg::Snapshot { .. }) => {}
            Err(broadcast::error::RecvError::Lagged(_)) => {
                // Slow consumer: resync from a fresh snapshot rather than
                // replaying everything it missed.
                let state = s.live.read().unwrap().clone();
                if send(&mut socket, &WsMsg::Snapshot { state }).await.is_err() {
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

// ---------- router ----------

fn router(state: ServerState) -> Router {
    // In dev the SPA is served by Vite (proxying /api and /ws to us); this
    // static mount is what LAN clients hit in the packaged app. Note: the
    // release bundle must embed dist/ (M4 packaging), cwd-relative is dev-only.
    let spa = ServeDir::new("../dist").not_found_service(ServeFile::new("../dist/index.html"));
    Router::new()
        .route("/api/health", get(health))
        .route("/api/live/state", get(live_state))
        .route("/api/live/next", post(live_next))
        .route("/api/live/prev", post(live_prev))
        .route("/api/live/go-to", post(live_go_to))
        .route("/api/live/toggle-visible", post(live_toggle_visible))
        .route("/ws", get(ws_handler))
        .nest_service("/app", spa)
        .with_state(state)
}

/// Run the embedded axum server on its own tokio runtime thread.
fn spawn_server(state: ServerState) {
    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("failed to build tokio runtime for embedded server");
        rt.block_on(async move {
            let addr = format!("0.0.0.0:{DEFAULT_PORT}");
            let listener = tokio::net::TcpListener::bind(&addr)
                .await
                .unwrap_or_else(|e| panic!("failed to bind embedded server on {addr}: {e}"));
            println!("cellpresenter embedded server: http://{addr}");
            axum::serve(listener, router(state))
                .await
                .expect("embedded server crashed");
        });
    });
}

// ---------- webview windows ----------

/// Webviews are just clients: they load the same URLs a phone on the LAN uses.
/// Dev uses the Vite dev server (HMR + proxy); release uses the axum-served SPA.
fn app_url(path_and_query: &str) -> WebviewUrl {
    let base = if cfg!(debug_assertions) {
        DEV_WEBVIEW_URL.to_string()
    } else {
        format!("http://127.0.0.1:{DEFAULT_PORT}/app/index.html")
    };
    WebviewUrl::External(format!("{base}{path_and_query}").parse().expect("valid webview url"))
}

fn console_url() -> WebviewUrl {
    app_url("")
}

fn display_url() -> WebviewUrl {
    app_url("?view=display")
}

pub fn run() {
    let (tx, _) = broadcast::channel(64);
    let state = ServerState {
        live: Arc::new(RwLock::new(LiveState::default())),
        tx,
    };
    spawn_server(state);

    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            WebviewWindowBuilder::new(&handle, "console", console_url())
                .title("CellPresenter Console")
                .inner_size(1280.0, 800.0)
                .min_inner_size(800.0, 600.0)
                .build()?;
            WebviewWindowBuilder::new(&handle, "display", display_url())
                .title("CellPresenter Display")
                .inner_size(960.0, 540.0)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
