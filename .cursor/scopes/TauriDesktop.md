# CellPresenter Desktop — Tauri Architecture

Architecture spec. North star for the new repo. Rewrite of `cellpresenter-web` from scratch — new architecture, all components rewritten (no code ported).

**Locked decisions (2026-08-09):** Tauri v2 shell · Rust backend (axum + sqlx) · webview loads the UI **from the embedded server URL** (console is byte-for-byte the same client as phones) · Dockview for the console workspace · all components rewritten from scratch.

## Purpose

A local-first desktop app for worship lyrics presentation. Everything (songs, setlists, backgrounds, notes, media) lives on the operator's machine. The app runs an embedded server that any device on the network can connect to for streaming — no accounts, no cloud, no latency.

**MVP success criteria:** One machine runs the console; a projector window on that machine *and* any phone/tablet on the LAN can open the display URL and see live slides, synced instantly.

## Architecture

One Rust process. The Tauri windows are not special — they open `http://127.0.0.1:PORT/...` exactly like a phone does.

```
┌────────────── Tauri v2 app (one Rust process) ──────────────┐
│                                                              │
│  tokio runtime                                               │
│  ├─ axum server bound to 0.0.0.0:PORT                        │
│  │   ├─ /api/*    → SQLite via sqlx  (songs, setlists, …)    │
│  │   ├─ /media/*  → files on disk                            │
│  │   ├─ /ws       → live-state broadcast (snapshot+events)   │
│  │   ├─ /app/*    → SPA static files (console/display/…)     │
│  │   └─ /native/* → localhost-only: projector window, quit   │
│  └─ live state in Rust: Arc<RwLock<LiveState>> + broadcast   │
│                                                              │
│  Webview windows (load the same URLs phones do)              │
│  ├─ "console"   → http://127.0.0.1:PORT/app/console          │
│  └─ "projector" → http://127.0.0.1:PORT/app/display          │
└──────────────────────────────────────────────────────────────┘
            ▲ HTTP/WS — identical API
   phones / tablets / laptops on LAN (open http://<ip>:PORT)
```

- **Live state lives in Rust** (`currentSongId`, `slideIndex`, `isLive`, `isVisible`, timers). Single source of truth. Mutations update Rust state and broadcast over WS. `Arc<RwLock<LiveState>>` + `tokio::sync::broadcast`.
- **Webview = just another client.** Console and projector windows load the SPA from the embedded server (`WebviewUrl::External`). Same origin as phones ⇒ zero CORS, zero special-casing.
- **Native operations go through `/native/*`** — HTTP endpoints that check the peer address is `127.0.0.1` before acting. Open/close projector window, second-monitor placement (position-then-show to avoid flicker), always-on-top, quit.
- **Remote access later** = point a tunnel (Tailscale / Cloudflare) at the local port. Protocol must never hardcode `localhost`; clients read a base URL.

## Tech stack

**Rust (src-tauri):** tauri v2, tokio, axum, tower-http (`ServeDir`), sqlx (SQLite), serde. WS via axum's websocket layer.

**Frontend (app/):** React 19 + TypeScript + Vite + Tailwind v4 + `dockview-react` v5. Zustand for UI/local state. Server state via `fetch` + a live-state hook subscribed to `/ws` (30-line reconnect/backoff client; no socket.io). Single SPA build served by axum (`/app/*`) and referenced by the native windows.

## Data model

Flatten the Convex schema to SQLite, drop all multi-tenant/auth fields.

- `songs` (title, artist, key, capo, ccli info, templateId, timestamps)
- `sections` (songId, name, order, backgroundId)
- `slides` (songId, sectionId, order, text, chords, backgroundId)
- `backgrounds` (name, filePath on disk, uploadedAt, size)
- `presentations` (current state: song, slide, visibility, watermark settings, operator notes)
- `setlists` (ordered entries → songId | announcementId)
- `announcements` (title, text, backgroundId)
- `presentationTemplates` (text position/style, background defaults, CCLI, watermark)

Auth/ownership fields (`userId`, Clerk identities) are dropped entirely — single local operator. `requireAuth`/`getCurrentUserId` ceremony that threaded through every `cellpresenter-web` function becomes a no-op.

## Client protocol

- **REST** `/api/*` for reads and writes of persistent data (function shapes mirror the web app: `getArrangedSlidesForCurrentSong`, `getPresentationByToken`, CRUD for each table).
- **WS** `/ws` for live state:
  - On connect, server sends a full `snapshot` (display clients are stateless — they render only from snapshots + deltas).
  - Then deltas: `{type: "navigate", songId, slideIndex}`, `{type: "visibility", …}`, `{type: "timer", …}`. Server broadcasts; all clients apply.
- **Token-based display links** carry over from the web app: `getPresentationByToken` → a long-lived per-projector token in the URL (`/app/display?token=…`). No accounts; the token is the auth.

## Repo layout + layering rules

```
cellpresenter/
├─ src-tauri/          # Rust
│  ├─ src/
│  │  ├─ main.rs       # tauri entry; spawns tokio; opens windows after server is healthy
│  │  ├─ state.rs      # LiveState + broadcast
│  │  ├─ db.rs         # sqlx pool + queries
│  │  ├─ api/          # thin axum handlers (songs.rs, setlists.rs, …)
│  │  ├─ ws.rs         # snapshot + delta broadcast
│  │  ├─ media.rs      # /media/* file serving
│  │  └─ native.rs     # /native/* — localhost-gated window/quit endpoints
│  └─ capabilities/
├─ app/                # React SPA (one build; served by axum AND bundled)
│  ├─ src/
│  │  ├─ lib/api.ts    # THE only fetch/WS module
│  │  ├─ lib/ws.ts     # reconnect wrapper
│  │  ├─ domain/       # pure logic: chord parser, transpose/capo, setlist math
│  │  ├─ console/      # Dockview shell + panels
│  │  ├─ display/      # projector renderers
│  │  ├─ remote/       # phone/tablet views
│  │  └─ ui/           # presentational components (no data access)
│  └─ vite + tailwind
```

**Layering rule (the one hard rule):** UI components never touch `fetch`/WS directly. Only `lib/api.ts` and the live-state hook talk to the server. This is the anti-pattern learned from both graphs — FreeShow's `actions/api.ts` sat at the center of every import cycle, and `cellpresenter-web`'s generated `api` was the top cross-community bridge. A single data-access module keeps the rewrite clean forever.

## Rewrite strategy (from scratch — no code ported)

All UI is rewritten. Pure logic is rewritten as small, tested modules in `app/src/domain/` (and mirrored in Rust where the server needs it — e.g. the chord parser, ~300 lines, ports once).

- **Rewrite:** console (Dockview shell + song library, editor, setlist, notes, timer, media, templates, share/display panels), projector renderers (MainDisplay, ChordsDisplay, MobileChordsDisplay, SetlistDisplay), remote phone/tablet views, shared UI kit (Button, Modal, Input, … themed to Dockview).
- **Borrow as concepts, not code:** the display renderers' visual language, token-based display links, `useUiFeedback` as a hook *signature* (now backed by fetch/WS instead of Convex).
- **Gone entirely:** Convex, Clerk auth, R2/S3, quotas, subscriptions, Next.js SSR, roadmap/support/admin tooling.

## Milestones

1. **Spike:** Tauri v2 + embedded axum serving the SPA + WS broadcast. Console window renders from the server URL; a second browser on the LAN sees it. Proves the thesis. ⚠️ Also verify video-background codecs on Linux WebKitGTK this early — it's the biggest webview-variance risk.
2. **Foundation:** SQLite schema + sqlx, `/api/*` handlers, live state in Rust with snapshot+delta WS, SPA skeleton (Vite + Tailwind + Dockview shell + `lib/api.ts` + live-state hook).
3. **Domain:** song model, chord parser (rewritten), song import (JSON export from web app), CRUD round-trips.
4. **Console:** Dockview workspace — song library, song editor (sections/slides/chords), setlist, notes, timer panels.
5. **Display:** projector renderers wired to WS/HTTP state, backgrounds + `/media/*` serving, CCLI/watermark.
6. **Remote:** phone/tablet console + display URLs, token-based display links, native projector window (second monitor, always-on-top), LAN discovery (mDNS, later add).
7. **Polish:** keyboard shortcuts, layout persistence (Dockview `toJSON`/`fromJSON`), exports, auto-update (`tauri-plugin-updater`), tunnel story.

## Out of scope (later / never)

- Multi-user accounts, subscriptions, quotas, ads
- Cloud sync (maybe an optional export later)
- Cross-device editing of the library
- NDI / Blackmagic / MIDI hardware integrations (FreeShow's Electron niche; not needed for this product)

## Reference

Graphs used to inform decisions (kept in-repo, generated with graphify):

- `.graphify/freeshow/` — FreeShow (Electron) architecture: embedded-server + socket.io broadcast pattern, LAN discovery
- `.graphify/web/` — cellpresenter-web: module boundaries, god nodes, rewrite surface
