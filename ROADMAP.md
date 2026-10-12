# CellPresenter Desktop — Build Roadmap

Free, open-source worship lyrics presentation. Cell groups first; built so it can grow into a ProPresenter alternative for bands and churches. North-star spec: `.cursor/scopes/TauriDesktop.md`. Live planning page (picks, build flow, open questions): https://claude.ai/artifact/HATbm1KBkEFxuebpVW1aqP

Every step ends in something you can demo or verify from outside the code. Built solo at about an hour a day, so releases stay small.

## Done

- **M0** — Tauri v2 + axum + React SPA dev loop.
- **M1** — Live state over WebSocket; a phone on the LAN and the native window stay in sync. Fixed 1920×1080 stage renders identically across devices.

## R1 — "My cell group runs on it"

Goal: run a cell group night on the new app instead of the web app. ~200–240 h estimated.

| Step | Items | Status |
|---|---|---|
| 1. Groundwork | Bundled UI in release builds · server binds before windows open, port fallback in release · Tauri's async runtime · real page addresses (`/display`) · tests + CI · translatable UI text · parity list | **done** |
| 2. Backend core + workspace | Split backend into a tested reducer · Dockview workspace shell with the A1 default layout and theme tokens (colours, radius, borders as CSS variables) · transpose + capo (TS) · smarter caching | **done** |
| 3. Song library | SQLite with sync-ready ids (UUIDv7, `updated_at`, soft delete, `library_id`) · versioned live updates · PIN for controls · keyboard + clicker control · generated TS types | **done** |
| 4. Content + live state | Paste lyrics → slides (explicit lines, font fits the longest line) · setlists + announcements · song arrangements · image backgrounds · live state holds pointers, not content | **done**: song editor (paste → slides), arrangements, fit-to-width, setlists + announcements, preview before going live, Next runs through the setlist, image backgrounds (per song, per announcement, default) with Clear text / Clear background |
| 5. Screens + search | Live/Next previews · phone remote page · audience phone view · chords view for musicians · song search (own library, paste/URL import, public-domain hymns) | Live/Next previews, audience view, **phone remote**, **chords view** (tap a chord for its guitar shapes) and **song search done**: Find songs searches Ultimate Guitar (chords) and LRCLIB (lyrics) or opens a pasted Ultimate Guitar link; imports are cleaned up and split into sections, repeats and evenly sized slides |

Releases: v0.1.0 ships as a preview before step 5 is finished (AGPL-3.0, installers for Mac, Windows and Linux built by the Release workflow). Song search and import ship in v0.2.

**Test for R1:** build a setlist from pasted chord sheets, run it from the console and a phone, and a musician's phone shows lyrics + chords in the transposed key.

## R2 — "Share with the team"

Accounts + cloud library (text and thumbnails always synced; full media stays on the home laptop) · setlist share links with chords · remote live control (sign-in + per-session room code; LAN stays the default) · ChordPro / OpenLyrics / plain-text import · Operate / Prepare modes · first-run guide · contributor docs.

## R3 — "Other churches"

Remote editing from another PC · team invites · opt-in media upload with temporary cloud copies · self-hostable cloud server (same Rust server, headless, one Docker image) · multiple output looks · undo · auto-update · Mac code signing · templates · timer + operator notes · more languages and scripts.

## Ideas to plan

Written down so they aren't lost; not scheduled yet.

- **Panels in their own windows.** Drag a tab out of the console to open it in a new window, like a browser tab (for example a dedicated Chords window on a second screen). Every panel already gets its data from the embedded server, so a panel can be its own page (`/panel/chords`) in a native window. Dragging a tab past the window edge opens that window. About one or two sessions. Dockview's built-in popout uses `window.open`, which Tauri blocks by default, so our own windows are the sturdier route. A plain "Open in new window" tab action comes first.
- **Confidence monitor (stage display).** A screen for the band and speaker: current and next slide, chords, clock, timer and notes. Its layout can be rearranged by dragging blocks, like ProPresenter's stage layouts, and saved as presets.
- **New windows and pages.** Any view can be opened as a window on this computer or as a page on another device, from the Layout menu or the Display link.
- **Several screens of different sizes.** Configure each output separately: projector, stage monitor, TV or livestream. Each gets its own aspect ratio (16:9, 4:3, 16:10, ultrawide), resolution, look and what it shows, and the app remembers which screen gets which output. This builds on the screen picker and R3's "multiple output looks".
- **Several languages.** The UI comes in more languages (all text already goes through `t()`). Lyrics can show in two languages at once, e.g. English with Chinese, with a font and size per language. This extends R3's "more languages and scripts".

## Principles

- **LAN first.** Live control never needs the internet; the cloud is a fallback and a sharing layer.
- **The desktop app owns live state.** Every screen, including the app's own windows, is a web client of its embedded server.
- **Domain logic in TypeScript** (`app/src/domain/`), unit-tested. Rust stays a thin layer for state, storage and serving.
- **One data-access module.** UI components never call `fetch` or the WebSocket directly.
- **All UI text goes through `t()`** (`app/src/i18n/`).

## Known issues (KIV — deferred)

- **Dev builds need port 9100.** The Vite proxy targets it. Release builds fall back to other ports automatically.
