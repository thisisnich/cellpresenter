mod live;
mod server;

use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

use server::ServerState;

const DEV_WEBVIEW_URL: &str = "http://localhost:5173";

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

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            // Bind before any window opens, so windows never load a server
            // that isn't there and a busy port is reported instead of hidden.
            let listener = tauri::async_runtime::block_on(server::bind()).map_err(|msg| {
                eprintln!("cellpresenter: {msg}");
                msg
            })?;
            let port = listener.local_addr()?.port();
            println!("cellpresenter embedded server: http://0.0.0.0:{port}");

            let state = ServerState::new(handle.asset_resolver());
            tauri::async_runtime::spawn(async move {
                if let Err(e) = axum::serve(listener, server::router(state)).await {
                    eprintln!("cellpresenter: embedded server stopped: {e}");
                }
            });

            open_windows(&handle, port)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
