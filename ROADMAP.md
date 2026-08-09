# CellPresenter Desktop — Build Roadmap

Testable milestones. Every milestone ends in something you can demo or verify; if a milestone can't be tested from outside the code, it's too big. North-star spec: `.cursor/scopes/TauriDesktop.md`.

## Critical path (the MVP spine)

```
Server serves SPA → live state broadcasts over WS → console mutates → display renders → reachable on LAN → native projector window
```

Everything hangs off the M1 spike. The data model, chord parser, and media are all *additive* once the live loop holds. Build the spine first, decorate later.

---

## M0 — Repo skeleton + dev workflow  (~½ day)

**Goal:** one command opens the app in dev with hot reload.

**Build:**
- Repo layout: `app/` (Vite + React + TS SPA) and `src-tauri/` (Tauri v2)
- Axum stub boots on a fixed dev port; `/api/health` returns ok
- Vite dev proxy forwards `/api`, `/ws`, `/media`, `/native` → axum (so `lib/api.ts` always uses relative URLs — same origin in dev and prod)
- Native windows point at Vite (`localhost:5173`) in dev, at the axum server in prod (runtime choice at window creation)

**Test:** `npm run tauri dev` opens a window showing the React page; `curl /api/health` → 200.

**Lock before you start:** dev base-URL scheme (Vite proxy), default port (pick one, e.g. `9100`), live-state protocol shape (snapshot-on-connect + versioned deltas).

---

## M1 — Spike: server-served app + live broadcast  (1–2 days)

**Goal (the product thesis):** a phone on the LAN *and* the native window both see live slide changes. If this works, the architecture is right. This is the milestone that de-risks everything.

**Build:**
- Axum serves the built SPA at `/app/*`
- Live state in Rust: `Arc<RwLock<LiveState>>` + `tokio::sync::broadcast`
- `/ws` endpoint: full snapshot on connect, then deltas
- `/native/next`, `/native/prev` (localhost-only) flip a placeholder slide index
- Minimal console page (Next / Prev buttons) + display page (renders "Song X · Slide Y")
- Tauri window opens `http://127.0.0.1:PORT/app/console` via `WebviewUrl::External`

**Test:**
1. `npm run build` then `npm run tauri dev` → console window appears
2. Open `http://<LAN-IP>:PORT/app/display` on a phone → shows slide 0
3. Clicking Next in the console advances the phone instantly
4. ⚠️ **Verify the built SPA + a test video background render on Linux WebKitGTK** — the biggest webview-variance risk; fail fast here

---

## M2 — Data foundation  (2–3 days)

**Goal:** songs/slides persist in SQLite; console and display read the same data.

**Build:**
- sqlx + SQLite; core tables (`songs`, `sections`, `slides`)
- `/api/songs`, `/api/songs/:id` (nested sections/slides), CRUD
- Live state references real songs; snapshot includes current song + slides
- SPA skeleton: `lib/api.ts` (fetch), `lib/ws.ts` (reconnect + snapshot/delta), live-state hook
- Single-instance plugin; bind `0.0.0.0:PORT` with a clear message if the port is busy

**Test:** create a song with 2 sections × 3 slides via `curl`, read it back; connect a WS client → snapshot; navigate via API → delta arrives.

---

## M3 — Domain: songs, chords, import  (2–4 days)

**Goal:** real song editing and import work.

**Build:**
- Song model + section/slide editing logic in `app/src/domain/` (pure, unit-tested)
- Chord parser (TS): chord-sheet text → slides; `transpose`, `applyCapo`, `detectKey` — port the logic from `cellpresenter-web`'s pure utils
- JSON import from the web app's export format
- Rust port of the parser only if a concrete server need appears (start TS-only)

**Test:** unit tests for the parser; import a real chord sheet → preview slides; transpose +2 / apply capo → correct chords; restart the app → song persists.

---

## M4 — Console workspace (Dockview)  (4–6 days)

**Goal:** an operator can run a whole service from the console.

**Build:**
- Dockview shell with panels: song library, song editor, setlist, notes, timer, media, templates, share/display links
- Panel add/close/dock/floating; layout persisted (localStorage — operator console only)
- Live controls: go live, next / prev / clear, visibility toggle
- **Layering rule from day one:** UI components never touch fetch/WS — only `lib/api.ts` + the live-state hook

**Test:** create song → build setlist → go live → advance slides → everything shows on display; restart app → library + layout intact; drag/dock panels work.

---

## M5 — Display renderers  (3–5 days)

**Goal:** projector output looks right.

**Build:**
- `MainDisplay`, `ChordsDisplay`, `MobileChordsDisplay`, `SetlistDisplay` — rewritten, borrowing the web app's visual language
- Backgrounds + `/media/*` serving; per-section / per-slide background inheritance
- CCLI + watermark

**Test:** phone display shows the right slide with background; chords display transposes correctly; watermark shows.

---

## M6 — Remote + native windows  (2–4 days)

**Goal:** full MVP success criteria.

**Build:**
- Remote phone/tablet console view (navigate, visibility)
- Display tokens (`/app/display?token=…`) backed by the `presentations` table
- Native projector window on a second monitor (position-then-show, always-on-top)
- LAN discovery via mDNS (`mdns-sd`) — phone finds the console without typing an IP

**Test:** MVP criteria — projector window on the machine *and* a phone on the LAN both show live-synced slides.

---

## M7 — Polish  (ongoing)

Keyboard shortcuts, undo, layout-persistence robustness, exports (JSON/PDF), auto-update (`tauri-plugin-updater`), settings page, tunnel story doc.

---

## What to start with

**M0 → M1, in one push.** M1 simultaneously de-risks the four scariest unknowns:
1. Tauri window loading a server URL (works — verified)
2. LAN reachability of the embedded server
3. WS broadcast + stateless display clients
4. Linux WebKitGTK rendering the built SPA + video backgrounds

M2 and M3 are bigger but purely additive once the spine holds. Do **not** start SQLite, chord parsing, or Dockview layout before M1 — they don't change whether the architecture works, and you'll be testing the hard thing (the live loop) last instead of first.

## Known issues (KIV — deferred)

- **Cross-device line wrapping (M1).** The Stage (1920×1080 canvas, uniform fit-scale) guarantees *proportional* text size on every screen, but auto-wrapping is still font-metric-dependent: a client that lays out with a fallback font (or engine-specific rasterization — WebKitGTK vs Chrome mobile vs Firefox) can break lines earlier at the same ratio. Verified on small screens. **Proper fix (M3, with the data model): never auto-wrap — store slides as explicit lines and size the font to fit the longest line** (what ProPresenter/EasyWorship do). Mitigations so far: bundled Inter + font-readiness gate before first paint + `Cache-Control: no-cache`.

## Decisions to lock before M0

- **Dev base URL:** Vite dev server + proxy for `/api`, `/ws`, `/media`, `/native`; native windows target Vite in dev, axum in prod
- **Default port:** reserve one now (e.g. `9100`), configurable, with EADDRINUSE handling
- **Live-state protocol:** snapshot-on-connect + versioned deltas; client re-requests snapshot on version gap
- **Data-access rule:** only `lib/api.ts` + the live-state hook talk to the server
