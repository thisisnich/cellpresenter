use std::sync::{Arc, RwLock};

use axum::{extract::State, routing::get, Json, Router};
use serde::Serialize;
use tauri::{WebviewUrl, WebviewWindowBuilder};

/// Port for the embedded HTTP + WebSocket server (must match Vite proxy target).
pub const DEFAULT_PORT: u16 = 9100;
const DEV_WEBVIEW_URL: &str = "http://localhost:5173";

#[derive(Serialize)]
struct Health {
    status: &'static str,
    version: &'static str,
}

/// Shared server state. M1 grows this into the live presentation state
/// (current song/slide, visibility, timers) plus a broadcast channel.
#[derive(Clone)]
struct ServerState {
    _live: Arc<RwLock<serde_json::Value>>,
}

async fn health(State(_state): State<ServerState>) -> Json<Health> {
    Json(Health {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

fn router(state: ServerState) -> Router {
    Router::new()
        .route("/api/health", get(health))
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

/// The console webview is just another client. In dev it loads the Vite dev
/// server (HMR, API proxied to axum); in release it loads the SPA served by
/// axum — the same URL a phone on the LAN uses.
fn console_url() -> WebviewUrl {
    if cfg!(debug_assertions) {
        WebviewUrl::External(DEV_WEBVIEW_URL.parse().expect("valid dev url"))
    } else {
        WebviewUrl::External(
            format!("http://127.0.0.1:{DEFAULT_PORT}/app/index.html")
                .parse()
                .expect("valid prod url"),
        )
    }
}

pub fn run() {
    let state = ServerState {
        _live: Arc::new(RwLock::new(serde_json::json!({}))),
    };
    spawn_server(state.clone());

    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            WebviewWindowBuilder::new(&handle, "console", console_url())
                .title("CellPresenter Console")
                .inner_size(1280.0, 800.0)
                .min_inner_size(800.0, 600.0)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
