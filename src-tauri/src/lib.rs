mod auth;
mod db;
mod live;
mod network;
mod seed;
mod server;
mod setlist;
mod song;

use std::net::SocketAddr;
use std::sync::Arc;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use auth::PinGuard;
use db::Db;
use server::{ServerState, WebAsset};

const DEV_WEBVIEW_URL: &str = "http://localhost:5173";
const LIBRARY_FILE: &str = "library.db";

// ---------- webview windows ----------

/// Webviews are just clients: they load the same URLs a phone on the LAN uses.
/// Dev uses the Vite dev server (HMR + proxy); release uses the axum server.
fn app_url(port: u16, path: &str) -> WebviewUrl {
    let base = if cfg!(debug_assertions) {
        DEV_WEBVIEW_URL.to_string()
    } else {
        format!("http://127.0.0.1:{port}")
    };
    WebviewUrl::External(format!("{base}{path}").parse().expect("valid webview url"))
}

fn open_windows(app: &AppHandle, port: u16) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, "console", app_url(port, "/"))
        .title("CellPresenter Console")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .build()?;
    WebviewWindowBuilder::new(app, "display", app_url(port, "/display"))
        .title("CellPresenter Display")
        .inner_size(960.0, 540.0)
        .build()?;
    Ok(())
}

/// Open the song library in the app's data folder, adding starter songs to a
/// brand-new library.
async fn open_library(app: &AppHandle) -> Result<Db, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data folder: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("can't create {}: {e}", dir.display()))?;
    let path = dir.join(LIBRARY_FILE);
    let db = Db::open(&path)
        .await
        .map_err(|e| format!("can't open the song library at {}: {e}", path.display()))?;
    seed::seed_if_empty(&db)
        .await
        .map_err(|e| format!("can't add starter songs: {e}"))?;
    println!("cellpresenter song library: {}", path.display());
    Ok(db)
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            let report = |msg: String| {
                eprintln!("cellpresenter: {msg}");
                msg
            };
            let db = tauri::async_runtime::block_on(open_library(&handle)).map_err(report)?;
            // Bind before any window opens, so windows never load a server
            // that isn't there and a busy port is reported instead of hidden.
            let listener = tauri::async_runtime::block_on(server::bind()).map_err(report)?;
            let port = listener.local_addr()?.port();
            println!("cellpresenter embedded server: http://0.0.0.0:{port}");

            let resolver = handle.asset_resolver();
            let assets = Arc::new(move |path: &str| {
                resolver.get(path.to_string()).map(|a| WebAsset {
                    mime_type: a.mime_type().to_string(),
                    bytes: a.bytes,
                })
            });
            let pins = PinGuard::random();
            let state = ServerState::new(assets, db, pins, port);
            tauri::async_runtime::block_on(state.restore_live());
            tauri::async_runtime::spawn(async move {
                state.spawn_persistence();
                let app = server::router(state).into_make_service_with_connect_info::<SocketAddr>();
                if let Err(e) = axum::serve(listener, app).await {
                    eprintln!("cellpresenter: embedded server stopped: {e}");
                }
            });

            open_windows(&handle, port)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
