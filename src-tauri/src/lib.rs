mod auth;
mod backup;
mod bible;
mod bible_online;
mod db;
mod feedback;
mod live;
mod media;
mod network;
mod online;
mod outputs;
mod seed;
mod server;
mod setlist;
mod song;
mod updates;

use std::net::SocketAddr;
use std::sync::Arc;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use auth::PinGuard;
use backup::Backups;
use db::Db;
use media::MediaStore;
use outputs::{Outputs, Screen, Screens};
use server::{ServerState, WebAsset};
use updates::{AvailableUpdate, Pending, Updater};

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

const DISPLAY: &str = "display";

fn open_windows(app: &AppHandle, port: u16) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, "console", app_url(port, "/"))
        .title("CellPresenter Console")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .build()?;
    open_display(app, port)?;
    Ok(())
}

fn open_display(app: &AppHandle, port: u16) -> tauri::Result<tauri::WebviewWindow> {
    // `?window=1` tells the page it is this app's own Display window, so
    // its F key asks the app (not the browser) for fullscreen.
    WebviewWindowBuilder::new(app, DISPLAY, app_url(port, "/display?window=1"))
        .title("CellPresenter Display")
        .inner_size(960.0, 540.0)
        .build()
}

/// The Display window on real screens, for the console's screen picker.
struct WindowOutputs {
    app: AppHandle,
    port: u16,
}

impl Outputs for WindowOutputs {
    fn screens(&self) -> Screens {
        let monitors = self.app.available_monitors().unwrap_or_default();
        let primary = self.app.primary_monitor().ok().flatten();
        let same = |a: &tauri::Monitor, b: &tauri::Monitor| {
            a.position() == b.position() && a.size() == b.size()
        };
        let app = self.app.clone();
        let output = on_main_thread(&self.app, move || {
            let window = app.get_webview_window(DISPLAY)?;
            if !is_fullscreen(&window) {
                return None;
            }
            window.current_monitor().ok().flatten()
        })
        .flatten()
        .and_then(|m| monitors.iter().position(|x| same(x, &m)))
        .map(|i| i as u32);
        Screens {
            screens: monitors
                .iter()
                .enumerate()
                .map(|(i, m)| Screen {
                    index: i as u32,
                    name: m
                        .name()
                        .cloned()
                        .unwrap_or_else(|| format!("Screen {}", i + 1)),
                    width: m.size().width,
                    height: m.size().height,
                    primary: primary.as_ref().is_some_and(|p| same(p, m)),
                })
                .collect(),
            output,
        }
    }

    fn show_on(&self, screen: Option<u32>) -> Result<(), String> {
        let monitor = match screen {
            Some(i) => Some(
                self.app
                    .available_monitors()
                    .map_err(|e| e.to_string())?
                    .into_iter()
                    .nth(i as usize)
                    .ok_or("no such screen")?,
            ),
            None => None,
        };
        let (app, port) = (self.app.clone(), self.port);
        // Windows are created and moved on the main thread.
        self.app
            .run_on_main_thread(move || {
                let window = match app.get_webview_window(DISPLAY) {
                    Some(w) => w,
                    None => match open_display(&app, port) {
                        Ok(w) => w,
                        Err(e) => return eprintln!("cellpresenter: can't open the display: {e}"),
                    },
                };
                if let Err(e) = place_display(&window, screen, monitor.as_ref()) {
                    eprintln!("cellpresenter: can't move the display: {e}");
                }
            })
            .map_err(|e| e.to_string())
    }

    fn toggle_fullscreen(&self) -> Result<(), String> {
        self.toggle()
    }
}

impl WindowOutputs {
    fn toggle(&self) -> Result<(), String> {
        let app = self.app.clone();
        self.app
            .run_on_main_thread(move || {
                let Some(window) = app.get_webview_window(DISPLAY) else {
                    return;
                };
                let result = if is_fullscreen(&window) {
                    place_display(&window, None, None)
                } else {
                    let current = window.current_monitor().ok().flatten();
                    let monitors = app.available_monitors().unwrap_or_default();
                    let index = current.as_ref().and_then(|c| {
                        monitors
                            .iter()
                            .position(|m| m.position() == c.position() && m.size() == c.size())
                    });
                    match (index, current) {
                        (Some(i), Some(m)) => place_display(&window, Some(i as u32), Some(&m)),
                        _ => window.set_fullscreen(true),
                    }
                };
                if let Err(e) = result {
                    eprintln!("cellpresenter: can't toggle fullscreen: {e}");
                }
            })
            .map_err(|e| e.to_string())
    }
}

/// Updates from GitHub releases through Tauri's updater, which checks each
/// download against the public key in tauri.conf.json.
struct AppUpdater {
    app: AppHandle,
    /// The update the last check found, kept for `install`.
    found: Arc<tokio::sync::Mutex<Option<tauri_plugin_updater::Update>>>,
}

impl Updater for AppUpdater {
    fn check(&self) -> Pending<Option<AvailableUpdate>> {
        use tauri_plugin_updater::UpdaterExt;
        let (app, found) = (self.app.clone(), self.found.clone());
        Box::pin(async move {
            let update = app
                .updater()
                .map_err(|e| e.to_string())?
                .check()
                .await
                .map_err(|e| e.to_string())?;
            let available = update.as_ref().map(|u| AvailableUpdate {
                version: u.version.clone(),
                notes: u.body.clone(),
            });
            *found.lock().await = update;
            Ok(available)
        })
    }

    fn install(&self) -> Pending<()> {
        let (app, found) = (self.app.clone(), self.found.clone());
        Box::pin(async move {
            let update = found.lock().await.take().ok_or("no update to install")?;
            update
                .download_and_install(|_, _| {}, || {})
                .await
                .map_err(|e| e.to_string())?;
            // The new version starts in a moment; answer the request first.
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                app.restart();
            });
            Ok(())
        })
    }
}

/// Run `f` on the main thread (where windows live) and wait for its answer.
fn on_main_thread<T: Send + 'static>(
    app: &AppHandle,
    f: impl FnOnce() -> T + Send + 'static,
) -> Option<T> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(f());
    })
    .ok()?;
    rx.recv_timeout(std::time::Duration::from_secs(2)).ok()
}

/// Whether the window fills a screen. On Linux this asks GTK, because the
/// fullscreen-on-a-monitor call below goes around Tauri's own bookkeeping.
fn is_fullscreen(window: &tauri::WebviewWindow) -> bool {
    #[cfg(target_os = "linux")]
    {
        use gtk::prelude::WidgetExt;
        window
            .gtk_window()
            .ok()
            .and_then(|w| w.window())
            .is_some_and(|w| w.state().contains(gtk::gdk::WindowState::FULLSCREEN))
    }
    #[cfg(not(target_os = "linux"))]
    {
        window.is_fullscreen().unwrap_or(false)
    }
}

/// Fullscreen on `monitor`, or back to a normal window.
fn place_display(
    window: &tauri::WebviewWindow,
    index: Option<u32>,
    monitor: Option<&tauri::Monitor>,
) -> tauri::Result<()> {
    window.show()?;
    let Some(monitor) = monitor else {
        #[cfg(target_os = "linux")]
        {
            use gtk::prelude::GtkWindowExt;
            window.gtk_window()?.unfullscreen();
        }
        window.set_fullscreen(false)?;
        return window.set_focus();
    };
    // Wayland doesn't let apps place windows, but GTK can still ask for
    // fullscreen on a given monitor; tao lists monitors in GDK's order.
    #[cfg(target_os = "linux")]
    {
        use gtk::prelude::{GtkWindowExt, WidgetExt};
        let _ = monitor;
        let gtk_window = window.gtk_window()?;
        if let Some(screen) = WidgetExt::screen(&gtk_window) {
            gtk_window.fullscreen_on_monitor(&screen, index.unwrap_or(0) as i32);
        }
        Ok(())
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = index;
        window.set_fullscreen(false)?;
        window.set_position(*monitor.position())?;
        window.set_fullscreen(true)
    }
}

/// Where the library, pictures and (for dev builds) backups live.
///
/// Development builds use their own `dev` folder, so trying out a change
/// never alters the library the installed app uses (a newer database
/// version, test songs). The first time, it starts as a copy of that
/// library.
fn data_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let installed = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data folder: {e}"))?;
    if !cfg!(debug_assertions) {
        return Ok(installed);
    }
    let dev = installed.join("dev");
    if !dev.join(LIBRARY_FILE).exists() && installed.join(LIBRARY_FILE).exists() {
        copy_library(&installed, &dev)
            .map_err(|e| format!("can't copy the library for dev: {e}"))?;
        println!(
            "cellpresenter (dev): started from a copy of {}",
            installed.display()
        );
    }
    Ok(dev)
}

/// Copy a library (database with its journal files, and pictures).
fn copy_library(from: &std::path::Path, to: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(to.join("media").join("thumbs"))?;
    for suffix in ["", "-wal", "-shm"] {
        let name = format!("{LIBRARY_FILE}{suffix}");
        if from.join(&name).exists() {
            std::fs::copy(from.join(&name), to.join(&name))?;
        }
    }
    for folder in ["media", "media/thumbs"] {
        for entry in std::fs::read_dir(from.join(folder))
            .into_iter()
            .flatten()
            .flatten()
        {
            if entry.path().is_file() {
                std::fs::copy(entry.path(), to.join(folder).join(entry.file_name()))?;
            }
        }
    }
    Ok(())
}

/// Open the song library in the app's data folder, adding starter songs to a
/// brand-new library.
async fn open_library(app: &AppHandle) -> Result<Db, String> {
    let dir = data_dir(app)?;
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
    // Compositing stays on. Turning it off (WEBKIT_DISABLE_COMPOSITING_MODE)
    // used to stop an AppImage fullscreen crash, but it also paints video on
    // the CPU, so backgrounds stutter. The crash was the AppImage's own
    // libwayland; the release build leaves that out and uses the system's.
    // If a machine still aborts when the Display goes fullscreen, set that
    // variable before launching.
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            let data = data_dir(&handle).map_err(report)?;
            let media_dir = data.join("media");
            let media = MediaStore::new(media_dir.clone())
                .map_err(|e| report(format!("can't create {}: {e}", media_dir.display())))?;
            // 4K uploads are scaled to 1080p before any window opens, so the
            // first play isn't the laggy original. This also moves a late
            // file index to the front. It can take a while for a long clip.
            let scaled = media.repack_videos();
            if !scaled.is_empty() {
                tauri::async_runtime::block_on(async {
                    for (hash, size) in &scaled {
                        if let Err(e) = db.set_media_file_size(hash, *size).await {
                            eprintln!("cellpresenter: couldn't record scaled video: {e}");
                        }
                    }
                });
            }
            let outputs = Arc::new(WindowOutputs {
                app: handle.clone(),
                port,
            });
            // Backups go where people can find them: Documents/CellPresenter
            // Backups (a dev build keeps its own beside its library).
            let backup_dir = if cfg!(debug_assertions) {
                data.join("backups")
            } else {
                handle
                    .path()
                    .document_dir()
                    .map(|d| d.join("CellPresenter Backups"))
                    .or_else(|_| handle.path().app_data_dir().map(|d| d.join("backups")))
                    .map_err(|e| report(format!("no folder for backups: {e}")))?
            };
            let backups = Backups::new(backup_dir.clone())
                .map_err(|e| report(format!("can't create {}: {e}", backup_dir.display())))?;
            let state = ServerState::new(assets, db, pins, port, media)
                .with_outputs(outputs)
                .with_backups(backups)
                .with_updater(Arc::new(AppUpdater {
                    app: handle.clone(),
                    found: Arc::default(),
                }));
            tauri::async_runtime::block_on(async {
                state.restore_live().await;
            });
            let backing_up = state.clone();
            tauri::async_runtime::spawn(async move { backing_up.auto_backup().await });
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
