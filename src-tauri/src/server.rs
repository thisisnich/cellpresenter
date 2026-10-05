use std::net::{Ipv4Addr, SocketAddr};
use std::sync::{Arc, RwLock};

use axum::{
    extract::{
        ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
        ConnectInfo, Path, Request, State,
    },
    http::{header, StatusCode, Uri},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use ts_rs::TS;
use uuid::Uuid;

use crate::auth::{Denied, PinGuard};
use crate::db::{Db, DbResult};
use crate::live::{Command, LiveState, Slide};
use crate::network::{self, NetworkInfo};
use crate::setlist::{announcement_slides, Setlist, SetlistInput, SetlistItem, SetlistSummary};
use crate::song::{Song, SongInput, SongSummary};

/// Preferred port. The Vite dev proxy targets it, so dev builds use it only.
pub const DEFAULT_PORT: u16 = 9100;
/// Release builds try this many ports from DEFAULT_PORT before asking the OS.
const PORT_ATTEMPTS: u16 = 10;
/// Header a phone or another computer sends the control PIN in.
pub const PIN_HEADER: &str = "x-cp-pin";

/// Messages pushed over /ws. A client gets one `snapshot` on connect, then
/// `update`s as state changes.
#[derive(Clone, Serialize, TS)]
#[serde(tag = "type", rename_all = "snake_case")]
#[ts(export)]
pub enum WsMsg {
    Snapshot { state: LiveState },
    Update { state: LiveState },
}

/// A file of the web app, as found by the asset lookup.
pub struct WebAsset {
    pub bytes: Vec<u8>,
    pub mime_type: String,
}

/// Finds web-app files by path. In the app this is Tauri's bundled assets;
/// tests pass a stub.
pub type AssetLookup = Arc<dyn Fn(&str) -> Option<WebAsset> + Send + Sync>;

#[derive(Clone)]
pub struct ServerState {
    live: Arc<RwLock<LiveState>>,
    tx: broadcast::Sender<WsMsg>,
    assets: AssetLookup,
    db: Db,
    pins: Arc<PinGuard>,
    port: u16,
}

impl ServerState {
    pub fn new(assets: AssetLookup, db: Db, pins: PinGuard, port: u16) -> Self {
        let (tx, _) = broadcast::channel(64);
        let session = Uuid::new_v4().simple().to_string();
        Self {
            live: Arc::new(RwLock::new(LiveState::new(session))),
            tx,
            assets,
            db,
            pins: Arc::new(pins),
            port,
        }
    }

    fn snapshot(&self) -> LiveState {
        self.live.read().unwrap().clone()
    }

    /// Apply one change to the live state, bump its version and broadcast it.
    fn mutate(&self, change: impl FnOnce(&mut LiveState)) -> LiveState {
        let state = {
            let mut live = self.live.write().unwrap();
            change(&mut live);
            live.version += 1;
            live.clone()
        };
        let _ = self.tx.send(WsMsg::Update {
            state: state.clone(),
        });
        state
    }
}

// ---------- surviving a restart ----------

const LIVE_STATE_KEY: &str = "live";

/// The part of live state worth restoring after a restart or crash: which
/// song, where in it, and how the screen looked.
#[derive(Serialize, Deserialize)]
struct SavedLive {
    song_id: Option<String>,
    #[serde(default)]
    setlist_id: Option<String>,
    #[serde(default)]
    item_id: Option<String>,
    slide_index: usize,
    visible: bool,
    text_scale: f64,
}

impl ServerState {
    /// Put back whatever was on air when the app last stopped.
    pub async fn restore_live(&self) {
        let saved = match self.db.get_state(LIVE_STATE_KEY).await {
            Ok(Some(json)) => serde_json::from_str::<SavedLive>(&json).ok(),
            _ => None,
        };
        let Some(saved) = saved else { return };
        let mut restored = false;
        if let (Some(setlist_id), Some(item_id)) = (&saved.setlist_id, &saved.item_id) {
            if let Ok(Some(setlist)) = self.db.get_setlist(setlist_id).await {
                if let Some(index) = setlist.items.iter().position(|i| i.id() == item_id) {
                    restored = matches!(
                        self.show_setlist_item(&setlist, index, SlideAt::Index(saved.slide_index))
                            .await,
                        Ok(Some(_))
                    );
                }
            }
        }
        let song = match (&saved.song_id, restored) {
            (Some(id), false) => self.db.get_song(id).await.ok().flatten(),
            _ => None,
        };
        self.mutate(|l| {
            if let Some(song) = song {
                let slides = song.live_slides();
                l.show(Some(song.id), song.title, slides, saved.slide_index);
            }
            l.visible = saved.visible;
            l.apply(Command::SetTextScale {
                scale: saved.text_scale,
            });
        });
    }

    /// Save live state whenever it changes. Bursts (a held arrow key) are
    /// coalesced so only the latest state is written.
    pub fn spawn_persistence(&self) -> tokio::task::JoinHandle<()> {
        let mut rx = self.tx.subscribe();
        let state = self.clone();
        tokio::spawn(async move {
            loop {
                match rx.recv().await {
                    Ok(_) | Err(broadcast::error::RecvError::Lagged(_)) => {}
                    Err(broadcast::error::RecvError::Closed) => break,
                }
                while rx.try_recv().is_ok() {}
                let live = state.snapshot();
                let saved = SavedLive {
                    song_id: live.song_id,
                    setlist_id: live.setlist_id,
                    item_id: live.item_id,
                    slide_index: live.slide_index,
                    visible: live.visible,
                    text_scale: live.text_scale,
                };
                let json = serde_json::to_string(&saved).expect("serialize saved live state");
                if let Err(e) = state.db.set_state(LIVE_STATE_KEY, &json).await {
                    eprintln!("cellpresenter: couldn't save live state: {e}");
                }
            }
        })
    }
}

// ---------- setlist items on air ----------

/// Where to start in an item's slides.
#[derive(Clone, Copy)]
enum SlideAt {
    Index(usize),
    Last,
}

impl ServerState {
    /// The slides an item shows, or None if its song is gone.
    async fn item_content(
        &self,
        item: &SetlistItem,
    ) -> DbResult<Option<(Option<String>, String, Vec<Slide>)>> {
        Ok(match item {
            SetlistItem::Song { song_id, .. } => self.db.get_song(song_id).await?.map(|song| {
                let slides = song.live_slides();
                (Some(song.id), song.title, slides)
            }),
            SetlistItem::Announcement { title, text, .. } => {
                Some((None, title.clone(), announcement_slides(title, text)))
            }
        })
    }

    /// Put item `index` of `setlist` on air. None if it can't be shown.
    async fn show_setlist_item(
        &self,
        setlist: &Setlist,
        index: usize,
        at: SlideAt,
    ) -> DbResult<Option<LiveState>> {
        let Some(item) = setlist.items.get(index) else {
            return Ok(None);
        };
        let Some((song_id, title, slides)) = self.item_content(item).await? else {
            return Ok(None);
        };
        let slide_index = match at {
            SlideAt::Index(i) => i,
            SlideAt::Last => slides.len().saturating_sub(1),
        };
        let (setlist_id, item_id) = (setlist.id.clone(), item.id().to_string());
        Ok(Some(self.mutate(|l| {
            l.show(song_id, title, slides, slide_index);
            l.setlist_id = Some(setlist_id);
            l.item_id = Some(item_id);
        })))
    }

    /// Move to the next (`dir` = 1) or previous (-1) item of the setlist on
    /// air, skipping items that can't be shown. None at either end.
    async fn step_item(
        &self,
        live: &LiveState,
        dir: isize,
        at: SlideAt,
    ) -> DbResult<Option<LiveState>> {
        let (Some(setlist_id), Some(item_id)) = (&live.setlist_id, &live.item_id) else {
            return Ok(None);
        };
        let Some(setlist) = self.db.get_setlist(setlist_id).await? else {
            return Ok(None);
        };
        let Some(pos) = setlist.items.iter().position(|i| i.id() == item_id) else {
            return Ok(None);
        };
        let mut target = pos as isize + dir;
        while target >= 0 && (target as usize) < setlist.items.len() {
            if let Some(state) = self
                .show_setlist_item(&setlist, target as usize, at)
                .await?
            {
                return Ok(Some(state));
            }
            target += dir;
        }
        Ok(None)
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

// ---------- errors ----------

/// An API failure: a status code plus a short machine-readable reason.
struct ApiError(StatusCode, &'static str);

#[derive(Serialize)]
struct ErrorBody {
    error: &'static str,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(ErrorBody { error: self.1 })).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(e: sqlx::Error) -> Self {
        eprintln!("cellpresenter: database error: {e}");
        ApiError(StatusCode::INTERNAL_SERVER_ERROR, "database_error")
    }
}

type ApiResult<T> = Result<Json<T>, ApiError>;

const NOT_FOUND: ApiError = ApiError(StatusCode::NOT_FOUND, "not_found");

// ---------- control access ----------

/// Lets a request through if it comes from this machine or carries the PIN.
async fn require_control(
    State(s): State<ServerState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Response {
    let supplied = request
        .headers()
        .get(PIN_HEADER)
        .and_then(|v| v.to_str().ok());
    match s.pins.check(peer.ip(), supplied) {
        Ok(()) => next.run(request).await,
        Err(Denied::PinRequired) => {
            ApiError(StatusCode::UNAUTHORIZED, "pin_required").into_response()
        }
        Err(Denied::TooManyAttempts) => {
            ApiError(StatusCode::TOO_MANY_REQUESTS, "too_many_attempts").into_response()
        }
    }
}

#[derive(Serialize, TS)]
#[ts(export)]
pub struct PinInfo {
    pub pin: String,
}

/// The PIN, for showing in the console. Only this machine may ask.
async fn pin(
    State(s): State<ServerState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
) -> ApiResult<PinInfo> {
    if !PinGuard::is_local(peer.ip()) {
        return Err(ApiError(StatusCode::FORBIDDEN, "local_only"));
    }
    Ok(Json(PinInfo {
        pin: s.pins.pin().to_string(),
    }))
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

/// Where phones can reach this computer, for the console's display link.
async fn network_info(State(s): State<ServerState>) -> Json<NetworkInfo> {
    Json(NetworkInfo {
        port: s.port,
        addresses: network::addresses(),
    })
}

async fn live_state(State(s): State<ServerState>) -> Json<LiveState> {
    Json(s.snapshot())
}

/// Apply one live command and return the new state. Every client — console,
/// phone remote, later the cloud live room — changes live state this way.
///
/// While a setlist is on air, Next on an item's last slide moves on to the
/// next item and Prev on its first slide goes back to the previous item's
/// last slide, so a whole night runs from one button.
async fn live_command(
    State(s): State<ServerState>,
    Json(command): Json<Command>,
) -> ApiResult<LiveState> {
    let live = s.snapshot();
    let crossing = match command {
        Command::Next if live.at_last_slide() => Some((1, SlideAt::Index(0))),
        Command::Prev if live.at_first_slide() => Some((-1, SlideAt::Last)),
        Command::NextItem => Some((1, SlideAt::Index(0))),
        Command::PrevItem => Some((-1, SlideAt::Index(0))),
        _ => None,
    };
    if let Some((dir, at)) = crossing {
        if let Some(state) = s.step_item(&live, dir, at).await? {
            return Ok(Json(state));
        }
    }
    Ok(Json(s.mutate(|l| l.apply(command))))
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct ShowItem {
    pub setlist_id: String,
    pub item_id: String,
    #[serde(default)]
    pub slide_index: usize,
}

/// Put a setlist item on air.
async fn live_show_item(
    State(s): State<ServerState>,
    Json(args): Json<ShowItem>,
) -> ApiResult<LiveState> {
    let setlist = s.db.get_setlist(&args.setlist_id).await?.ok_or(NOT_FOUND)?;
    let index = setlist
        .items
        .iter()
        .position(|i| i.id() == args.item_id)
        .ok_or(NOT_FOUND)?;
    let state = s
        .show_setlist_item(&setlist, index, SlideAt::Index(args.slide_index))
        .await?
        .ok_or(ApiError(StatusCode::CONFLICT, "song_missing"))?;
    Ok(Json(state))
}

#[derive(Deserialize, TS)]
#[ts(export)]
pub struct ShowSong {
    pub song_id: String,
    #[serde(default)]
    pub slide_index: usize,
}

/// Put a library song on air.
async fn live_show_song(
    State(s): State<ServerState>,
    Json(args): Json<ShowSong>,
) -> ApiResult<LiveState> {
    let song = s.db.get_song(&args.song_id).await?.ok_or(NOT_FOUND)?;
    let slides = song.live_slides();
    Ok(Json(s.mutate(|l| {
        l.show(Some(song.id), song.title, slides, args.slide_index);
        l.setlist_id = None;
        l.item_id = None;
    })))
}

async fn list_songs(State(s): State<ServerState>) -> ApiResult<Vec<SongSummary>> {
    Ok(Json(s.db.list_songs().await?))
}

async fn get_song(State(s): State<ServerState>, Path(id): Path<String>) -> ApiResult<Song> {
    Ok(Json(s.db.get_song(&id).await?.ok_or(NOT_FOUND)?))
}

fn validate(input: &SongInput) -> Result<(), ApiError> {
    if input.title.trim().is_empty() {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY, "title_required"));
    }
    Ok(())
}

async fn create_song(
    State(s): State<ServerState>,
    Json(input): Json<SongInput>,
) -> Result<(StatusCode, Json<Song>), ApiError> {
    validate(&input)?;
    Ok((StatusCode::CREATED, Json(s.db.create_song(&input).await?)))
}

async fn update_song(
    State(s): State<ServerState>,
    Path(id): Path<String>,
    Json(input): Json<SongInput>,
) -> ApiResult<Song> {
    validate(&input)?;
    let song = s.db.update_song(&id, &input).await?.ok_or(NOT_FOUND)?;
    // If this song is on air, show the edit straight away.
    if s.snapshot().song_id.as_deref() == Some(id.as_str()) {
        let slides = song.live_slides();
        let (song_id, title) = (song.id.clone(), song.title.clone());
        s.mutate(|l| {
            let index = l.slide_index;
            l.show(Some(song_id), title, slides, index);
        });
    }
    Ok(Json(song))
}

async fn delete_song(
    State(s): State<ServerState>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    if s.db.delete_song(&id).await? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(NOT_FOUND)
    }
}

async fn list_setlists(State(s): State<ServerState>) -> ApiResult<Vec<SetlistSummary>> {
    Ok(Json(s.db.list_setlists().await?))
}

async fn get_setlist(State(s): State<ServerState>, Path(id): Path<String>) -> ApiResult<Setlist> {
    Ok(Json(s.db.get_setlist(&id).await?.ok_or(NOT_FOUND)?))
}

fn validate_setlist(input: &SetlistInput) -> Result<(), ApiError> {
    if input.name.trim().is_empty() {
        return Err(ApiError(StatusCode::UNPROCESSABLE_ENTITY, "name_required"));
    }
    Ok(())
}

async fn create_setlist(
    State(s): State<ServerState>,
    Json(input): Json<SetlistInput>,
) -> Result<(StatusCode, Json<Setlist>), ApiError> {
    validate_setlist(&input)?;
    Ok((
        StatusCode::CREATED,
        Json(s.db.create_setlist(&input).await?),
    ))
}

async fn update_setlist(
    State(s): State<ServerState>,
    Path(id): Path<String>,
    Json(input): Json<SetlistInput>,
) -> ApiResult<Setlist> {
    validate_setlist(&input)?;
    let setlist = s.db.update_setlist(&id, &input).await?.ok_or(NOT_FOUND)?;
    // If an item of this setlist is on air (say an announcement just edited),
    // show the new version in place.
    let live = s.snapshot();
    if live.setlist_id.as_deref() == Some(id.as_str()) {
        if let Some(index) = setlist
            .items
            .iter()
            .position(|i| Some(i.id()) == live.item_id.as_deref())
        {
            s.show_setlist_item(&setlist, index, SlideAt::Index(live.slide_index))
                .await?;
        }
    }
    Ok(Json(setlist))
}

async fn delete_setlist(
    State(s): State<ServerState>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    if s.db.delete_setlist(&id).await? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(NOT_FOUND)
    }
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

/// Serve the web app. Unknown paths get index.html so client-side routes like
/// /display work on a hard refresh.
async fn spa(State(s): State<ServerState>, uri: Uri) -> Response {
    let path = uri.path();
    let is_hashed_asset = path.starts_with("/assets/");
    // The bundled lookup already falls back to index.html; the dev lookup
    // reads files straight from dist/ and doesn't, so fall back here too.
    let found = (s.assets)(path).or_else(|| {
        (!is_hashed_asset)
            .then(|| (s.assets)("index.html"))
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
    if is_hashed_asset && asset.mime_type.starts_with("text/html") {
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
            (header::CONTENT_TYPE, asset.mime_type),
            (header::CACHE_CONTROL, cache.to_string()),
        ],
        asset.bytes,
    )
        .into_response()
}

// ---------- router ----------

/// Serve with `into_make_service_with_connect_info::<SocketAddr>()`: control
/// routes look at the caller's address.
pub fn router(state: ServerState) -> Router {
    let control = Router::new()
        .route("/live/command", post(live_command))
        .route("/live/show-song", post(live_show_song))
        .route("/live/show-item", post(live_show_item))
        .route("/setlists", post(create_setlist))
        .route(
            "/setlists/{id}",
            axum::routing::put(update_setlist).delete(delete_setlist),
        )
        .route("/songs", post(create_song))
        .route(
            "/songs/{id}",
            axum::routing::put(update_song).delete(delete_song),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            require_control,
        ));
    let api = Router::new()
        .route("/health", get(health))
        .route("/pin", get(pin))
        .route("/network", get(network_info))
        .route("/live/state", get(live_state))
        .route("/songs", get(list_songs))
        .route("/songs/{id}", get(get_song))
        .route("/setlists", get(list_setlists))
        .route("/setlists/{id}", get(get_setlist))
        .merge(control)
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
    use crate::seed::seed_if_empty;
    use axum::body::{to_bytes, Body};
    use axum::extract::connect_info::MockConnectInfo;
    use axum::http::Request as HttpRequest;
    use tower::ServiceExt;

    const LOCAL: &str = "127.0.0.1:50000";
    const PHONE: &str = "192.168.1.23:50000";

    async fn app(peer: &str) -> (Router, ServerState) {
        let db = Db::in_memory().await.unwrap();
        seed_if_empty(&db).await.unwrap();
        let state = ServerState::new(Arc::new(|_| None), db, PinGuard::new("4321".into()), 9100);
        let router =
            router(state.clone()).layer(MockConnectInfo(peer.parse::<SocketAddr>().unwrap()));
        (router, state)
    }

    async fn call(
        router: &Router,
        method: &str,
        uri: &str,
        body: Option<&str>,
        pin: Option<&str>,
    ) -> (StatusCode, String) {
        let mut req = HttpRequest::builder().method(method).uri(uri);
        if body.is_some() {
            req = req.header(header::CONTENT_TYPE, "application/json");
        }
        if let Some(pin) = pin {
            req = req.header(PIN_HEADER, pin);
        }
        let req = req
            .body(Body::from(body.unwrap_or("").to_string()))
            .unwrap();
        let res = router.clone().oneshot(req).await.unwrap();
        let status = res.status();
        let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
        (status, String::from_utf8_lossy(&bytes).into_owned())
    }

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

    #[tokio::test]
    async fn phones_can_read_but_need_the_pin_to_control() {
        let (router, _) = app(PHONE).await;
        assert_eq!(
            call(&router, "GET", "/api/songs", None, None).await.0,
            StatusCode::OK
        );
        let next = Some(r#"{"type":"next"}"#);
        assert_eq!(
            call(&router, "POST", "/api/live/command", next, None)
                .await
                .0,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            call(&router, "POST", "/api/live/command", next, Some("0000"))
                .await
                .0,
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            call(&router, "POST", "/api/live/command", next, Some("4321"))
                .await
                .0,
            StatusCode::OK
        );
        assert_eq!(
            call(&router, "GET", "/api/pin", None, None).await.0,
            StatusCode::FORBIDDEN
        );
    }

    #[tokio::test]
    async fn this_machine_controls_freely_and_can_read_the_pin() {
        let (router, _) = app(LOCAL).await;
        let (status, body) = call(&router, "GET", "/api/pin", None, None).await;
        assert_eq!(status, StatusCode::OK);
        assert!(body.contains("4321"));
        let next = Some(r#"{"type":"next"}"#);
        assert_eq!(
            call(&router, "POST", "/api/live/command", next, None)
                .await
                .0,
            StatusCode::OK
        );
    }

    #[tokio::test]
    async fn show_song_puts_a_library_song_on_air_and_bumps_the_version() {
        let (router, state) = app(LOCAL).await;
        let songs = state.db.list_songs().await.unwrap();
        let well = songs.iter().find(|s| s.title == "It Is Well").unwrap();
        let before = state.snapshot().version;

        let body = format!(r#"{{"song_id":"{}","slide_index":2}}"#, well.id);
        let (status, _) = call(&router, "POST", "/api/live/show-song", Some(&body), None).await;
        assert_eq!(status, StatusCode::OK);
        let live = state.snapshot();
        assert_eq!(live.title, "It Is Well");
        assert_eq!(live.slide_index, 2);
        assert_eq!(live.slides.len(), 9);
        assert_eq!(live.version, before + 1);

        let missing = Some(r#"{"song_id":"nope"}"#);
        assert_eq!(
            call(&router, "POST", "/api/live/show-song", missing, None)
                .await
                .0,
            StatusCode::NOT_FOUND
        );
    }

    #[tokio::test]
    async fn editing_the_song_on_air_updates_live_state() {
        let (router, state) = app(LOCAL).await;
        let id = state.db.list_songs().await.unwrap()[0].id.clone();
        call(
            &router,
            "POST",
            "/api/live/show-song",
            Some(&format!(r#"{{"song_id":"{id}"}}"#)),
            None,
        )
        .await;

        let edit = r#"{"title":"Renamed","sections":[{"name":"Verse 1","slides":[{"lines":[{"text":"New line"}]}]}]}"#;
        let (status, _) = call(
            &router,
            "PUT",
            &format!("/api/songs/{id}"),
            Some(edit),
            None,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let live = state.snapshot();
        assert_eq!(live.title, "Renamed");
        assert_eq!(live.slides[0].text, "New line");
    }

    #[tokio::test]
    async fn what_was_on_air_survives_a_restart() {
        let (router, first) = app(LOCAL).await;
        first.spawn_persistence();
        let id = first.db.list_songs().await.unwrap()[0].id.clone();
        call(
            &router,
            "POST",
            "/api/live/show-song",
            Some(&format!(r#"{{"song_id":"{id}","slide_index":2}}"#)),
            None,
        )
        .await;
        call(
            &router,
            "POST",
            "/api/live/command",
            Some(r#"{"type":"toggle_visible"}"#),
            None,
        )
        .await;

        // Wait for the background save.
        for _ in 0..100 {
            if let Some(json) = first.db.get_state(LIVE_STATE_KEY).await.unwrap() {
                if json.contains("\"visible\":false") {
                    break;
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        }

        let second = ServerState::new(
            Arc::new(|_| None),
            first.db.clone(),
            PinGuard::new("1".into()),
            9100,
        );
        second.restore_live().await;
        let live = second.snapshot();
        assert_eq!(live.song_id.as_deref(), Some(id.as_str()));
        assert_eq!(live.slide_index, 2);
        assert!(!live.visible);
        assert_ne!(live.session, first.snapshot().session);
    }

    #[tokio::test]
    async fn next_runs_through_a_whole_setlist_and_survives_a_restart() {
        let (router, state) = app(LOCAL).await;
        state.spawn_persistence();
        let songs = state.db.list_songs().await.unwrap();
        let grace = songs.iter().find(|s| s.title == "Amazing Grace").unwrap(); // 8 slides
        let holy = songs
            .iter()
            .find(|s| s.title == "Holy, Holy, Holy")
            .unwrap();
        let body = format!(
            r#"{{"name":"Friday","items":[
                {{"kind":"song","song_id":"{}"}},
                {{"kind":"announcement","title":"Potluck","text":"Potluck next Friday"}},
                {{"kind":"song","song_id":"{}"}}]}}"#,
            grace.id, holy.id
        );
        let (status, body) = call(&router, "POST", "/api/setlists", Some(&body), None).await;
        assert_eq!(status, StatusCode::CREATED);
        let setlist: Setlist = serde_json::from_str(&body).unwrap();
        let first = setlist.items[0].id().to_string();

        let show = format!(
            r#"{{"setlist_id":"{}","item_id":"{first}","slide_index":7}}"#,
            setlist.id
        );
        assert_eq!(
            call(&router, "POST", "/api/live/show-item", Some(&show), None)
                .await
                .0,
            StatusCode::OK
        );
        assert_eq!(state.snapshot().title, "Amazing Grace");

        let next = Some(r#"{"type":"next"}"#);
        let prev = Some(r#"{"type":"prev"}"#);
        // Last slide of the song → the announcement.
        call(&router, "POST", "/api/live/command", next, None).await;
        let live = state.snapshot();
        assert_eq!(live.title, "Potluck");
        assert_eq!(live.song_id, None);
        assert_eq!(live.slides[0].text, "Potluck next Friday");
        // Prev from its first slide → back to the song's last slide.
        call(&router, "POST", "/api/live/command", prev, None).await;
        let live = state.snapshot();
        assert_eq!(
            (live.title.as_str(), live.slide_index),
            ("Amazing Grace", 7)
        );
        // Next item twice → the last song; Next on its last slide stays put.
        call(
            &router,
            "POST",
            "/api/live/command",
            Some(r#"{"type":"next_item"}"#),
            None,
        )
        .await;
        call(
            &router,
            "POST",
            "/api/live/command",
            Some(r#"{"type":"next_item"}"#),
            None,
        )
        .await;
        assert_eq!(state.snapshot().title, "Holy, Holy, Holy");
        call(
            &router,
            "POST",
            "/api/live/command",
            Some(r#"{"type":"go_to","index":7}"#),
            None,
        )
        .await;
        call(&router, "POST", "/api/live/command", next, None).await;
        let live = state.snapshot();
        assert_eq!(
            (live.title.as_str(), live.slide_index),
            ("Holy, Holy, Holy", 7)
        );

        // Restart: the setlist position comes back.
        for _ in 0..100 {
            let saved = state
                .db
                .get_state(LIVE_STATE_KEY)
                .await
                .unwrap()
                .unwrap_or_default();
            if saved.contains(&setlist.items[2].id().to_string())
                && saved.contains("\"slide_index\":7")
            {
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        }
        let restarted = ServerState::new(
            Arc::new(|_| None),
            state.db.clone(),
            PinGuard::new("1".into()),
            9100,
        );
        restarted.restore_live().await;
        let live = restarted.snapshot();
        assert_eq!(live.setlist_id.as_deref(), Some(setlist.id.as_str()));
        assert_eq!(live.item_id.as_deref(), Some(setlist.items[2].id()));
        assert_eq!(live.slide_index, 7);

        // Showing a library song directly leaves setlist mode.
        let solo = format!(r#"{{"song_id":"{}"}}"#, grace.id);
        call(&router, "POST", "/api/live/show-song", Some(&solo), None).await;
        assert_eq!(state.snapshot().setlist_id, None);
    }

    #[tokio::test]
    async fn editing_the_announcement_on_air_updates_the_screen() {
        let (router, state) = app(LOCAL).await;
        let (_, body) = call(
            &router,
            "POST",
            "/api/setlists",
            Some(r#"{"name":"N","items":[{"kind":"announcement","title":"Welcome","text":"Hello"}]}"#),
            None,
        )
        .await;
        let setlist: Setlist = serde_json::from_str(&body).unwrap();
        let item = setlist.items[0].id().to_string();
        let show = format!(r#"{{"setlist_id":"{}","item_id":"{item}"}}"#, setlist.id);
        call(&router, "POST", "/api/live/show-item", Some(&show), None).await;
        let edit = format!(
            r#"{{"name":"N","items":[{{"kind":"announcement","id":"{item}","title":"Welcome","text":"Hello everyone"}}]}}"#
        );
        let (status, _) = call(
            &router,
            "PUT",
            &format!("/api/setlists/{}", setlist.id),
            Some(&edit),
            None,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(state.snapshot().slides[0].text, "Hello everyone");
        let blank = Some(r#"{"name":" ","items":[]}"#);
        assert_eq!(
            call(&router, "POST", "/api/setlists", blank, None).await.0,
            StatusCode::UNPROCESSABLE_ENTITY
        );
    }

    #[tokio::test]
    async fn song_crud_validates_and_soft_deletes() {
        let (router, _) = app(LOCAL).await;
        let blank = Some(r#"{"title":"  ","sections":[]}"#);
        assert_eq!(
            call(&router, "POST", "/api/songs", blank, None).await.0,
            StatusCode::UNPROCESSABLE_ENTITY
        );

        let (status, body) = call(
            &router,
            "POST",
            "/api/songs",
            Some(r#"{"title":"New","sections":[]}"#),
            None,
        )
        .await;
        assert_eq!(status, StatusCode::CREATED);
        let song: Song = serde_json::from_str(&body).unwrap();
        assert_eq!(
            call(
                &router,
                "DELETE",
                &format!("/api/songs/{}", song.id),
                None,
                None
            )
            .await
            .0,
            StatusCode::NO_CONTENT
        );
        assert_eq!(
            call(
                &router,
                "GET",
                &format!("/api/songs/{}", song.id),
                None,
                None
            )
            .await
            .0,
            StatusCode::NOT_FOUND
        );
        assert_eq!(
            call(&router, "GET", "/api/nothing", None, None).await.0,
            StatusCode::NOT_FOUND
        );
    }
}
